import {
	GithubClientBlockedIpError,
	GithubClientError,
	GithubClientTimeoutError,
	GithubClientInvalidPermissionsError,
	GithubClientRateLimitingError,
	GithubClientNotFoundError,
	GithubClientSSOLoginError
} from "./github-client-errors";
import Logger from "bunyan";
import { statsd } from "config/statsd";
import { metricError } from "config/metric-names";
import { AxiosError, AxiosRequestConfig } from "axios";
import { extractPath } from "../../jira/client/axios";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { getCloudOrServerFromHost } from "utils/get-cloud-or-server";

const RESPONSE_TIME_HISTOGRAM_BUCKETS = "100_1000_2000_3000_5000_10000_30000_60000";

/**
 * Enrich the config object to include the time that the request started.
 *
 * @param {import("axios").AxiosRequestConfig} config - The Axios request configuration object.
 * @returns {import("axios").AxiosRequestConfig} The enriched config object.
 */
export const setRequestStartTime = (config) => {
	config.requestStartTime = new Date();
	return config;
};

/**
 * Sets the timeout to the request based on the github-client-timeout feature flag
 */
export const setRequestTimeout = async (config: AxiosRequestConfig): Promise<AxiosRequestConfig> => {
	const timeout = await numberFlag(NumberFlags.GITHUB_CLIENT_TIMEOUT, 60000);
	//Check if timeout is set already explicitly in the call
	if (!config.timeout && timeout) {
		config.timeout = timeout;
	}
	return config;
};

//TODO Move to util/axios/common-github-webhook-middleware.ts and use with Jira Client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendResponseMetrics = (metricName: string, gitHubProduct: string, jiraHost: string | undefined, response?: any, status?: string | number, extraTags?: Record<string, string | undefined>) => {
	status = `${status?.toString() || response?.status as string}`;
	const requestDurationMs = Number(
		Date.now() - (response?.config?.requestStartTime || 0)
	);

	// using client tag to separate GH client from Octokit
	const tags = {
		client: "axios",
		gitHubProduct,
		method: response?.config?.method?.toUpperCase(),
		path: extractPath(response?.config?.originalUrl),
		status: status,
		...extraTags,
		...response?.config?.metrics
	};

	statsd.histogram(metricName, requestDurationMs, tags, { jiraHost });
	tags["gsd_histogram"] = RESPONSE_TIME_HISTOGRAM_BUCKETS;
	statsd.histogram(metricName, requestDurationMs, tags, { jiraHost });
	return response;
};

export const instrumentRequest = (metricName, host, jiraHost: string | undefined, extraTags?: Record<string, string | undefined>) =>
	(response) => {
		if (!response) {
			return;
		}

		const gitHubProduct = getCloudOrServerFromHost(host);
		return sendResponseMetrics(metricName, gitHubProduct, jiraHost, response, undefined, extraTags);
	};

/**
 * Submit statsd metrics on failed requests.
 *
 * @param {import("axios").AxiosError} error - The Axios error response object.
 * @param metricName - Name for the response metric
 * @param host - The rest API url for cloud/server
 * @returns {Promise<Error>} a rejected promise with the error inside.
 */
export const instrumentFailedRequest = (metricName: string, host: string, jiraHost: string | undefined, extraTags?: Record<string, string | undefined>) =>
	(error) => {
		const gitHubProduct = getCloudOrServerFromHost(host);
		if (error instanceof GithubClientRateLimitingError) {
			sendResponseMetrics(metricName, gitHubProduct, jiraHost, error.cause?.response, "rateLimiting", extraTags);
		} else if (error instanceof GithubClientBlockedIpError) {
			sendResponseMetrics(metricName, gitHubProduct, jiraHost, error.cause?.response, "blockedIp", extraTags);
			statsd.increment(metricError.blockedByGitHubAllowlist, { gitHubProduct }, { jiraHost });
		} else if (error instanceof GithubClientTimeoutError) {
			sendResponseMetrics(metricName, gitHubProduct, jiraHost, error.cause?.response, "timeout", extraTags);
		} else if (error instanceof GithubClientSSOLoginError) {
			sendResponseMetrics(metricName, gitHubProduct, jiraHost, error.cause?.response, "ssoLogin", extraTags);
		} else if (error instanceof GithubClientError) {
			sendResponseMetrics(metricName, gitHubProduct, jiraHost, error.cause?.response, undefined, extraTags);
		} else {
			sendResponseMetrics(metricName, gitHubProduct, jiraHost, error.response, undefined, extraTags);
		}
		return Promise.reject(error);
	};

export const handleFailedRequest = (rootLogger: Logger) =>
	(err: AxiosError) => {
		const { response, config, request } = err;
		const requestId = response?.headers?.["x-github-request-id"];
		const logger = rootLogger.child({
			err,
			config,
			request,
			response,
			requestId
		});

		const errorMessage = `Error executing Axios Request: ` + err.message;
		logger.warn(errorMessage);

		if (response?.status === 408 || err.code === "ETIMEDOUT") {
			logger.warn("Request timed out");
			return Promise.reject(new GithubClientTimeoutError(err));
		}

		if (response) {
			// Please keep in sync with GraphQL error mappings!!!!
			// TODO: consider moving both into some single error mapper to keep them close and avoid being not in sync

			const status = response?.status;

			const rateLimitRemainingHeaderValue: string = response.headers?.["x-ratelimit-remaining"];
			if (status === 403 && rateLimitRemainingHeaderValue == "0") {
				const mappedError = new GithubClientRateLimitingError(err);
				logger.warn({ err: mappedError }, "Rate limiting error");
				return Promise.reject(mappedError);
			}

			if (status === 403 && response.data?.message?.includes("has an IP allow list enabled")) {
				const mappedError = new GithubClientBlockedIpError(err);
				logger.warn({ err: mappedError, remote: response.data.message }, "Blocked by GitHub allowlist");
				return Promise.reject(mappedError);
			}

			if (status === 403 && response.data?.message?.includes("Resource not accessible by integration")) {
				const mappedError = new GithubClientInvalidPermissionsError(err);
				logger.warn({
					err: mappedError,
					remote: response.data.message
				}, "unauthorized");
				return Promise.reject(mappedError);
			}

			if (status === 403 && response.headers?.["x-github-sso"]) {
				const mappedError = new GithubClientSSOLoginError(err);
				logger.warn({ err: mappedError, remote: response.data.message }, "SSO Login required");
				return Promise.reject(mappedError);
			}

			if (status === 404) {
				const mappedError = new GithubClientNotFoundError(err);
				logger.warn({
					err: mappedError,
					remote: response.data.message
				}, "not found");
				return Promise.reject(mappedError);
			}

			const isWarning = status && (status >= 300 && status < 500 && status !== 400);

			if (isWarning) {
				logger.debug(errorMessage);
			} else {
				logger.error(errorMessage);
			}

			const mappedError = new GithubClientError(errorMessage, err);
			logger.warn({ err: mappedError }, "GitHubClientError");
			return Promise.reject(mappedError);
		}

		return Promise.reject(err);
	};

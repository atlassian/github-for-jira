import Logger from "bunyan";
import axios, { AxiosError, AxiosInstance } from "axios";

import url from "url";
import { statsd } from "config/statsd";
import { getLogger } from "config/logger";
import { metricHttpRequest } from "config/metric-names";
import { urlParamsMiddleware } from "utils/axios/url-params-middleware";
import { jiraAuthMiddleware } from "utils/axios/jira-auth-middleware";

/**
 * Wrapper for AxiosError, which includes error status
 */
export class JiraClientError extends Error {
	status?: number;
	cause: AxiosError;

	constructor(message: string, cause: AxiosError, status?: number) {
		super(message);
		this.status = status;

		//Remove config from the cause to prevent large payloads from being logged
		this.cause = { ...cause, config: {} };
	}
}

export const getJiraErrorMessages = (status: number) => {
	switch (status) {
		case 400:
			return "HTTP 400 - Request had incorrect format.";
		case 401:
			return "HTTP 401 - Missing a JWT token, or token is invalid.";
		case 403:
			return "HTTP 403 - The JWT token used does not correspond to an app that defines the jiraDevelopmentTool module, or the app does not define the 'WRITE' scope";
		case 413:
			return "HTTP 413 - Data is too large. Submit fewer devinfo entities in each payload.";
		case 429:
			return "HTTP 429 - API rate limit has been exceeded.";
		default:
			return `HTTP ${status}`;
	}
};

/**
 * Middleware to enhance failed requests in Jira.
 */
const getErrorMiddleware = (logger: Logger) =>
	/**
	 * Potentially enrich the promise's rejection.
	 *
	 * @param {import("axios").AxiosError} err - The error response from Axios
	 * @returns {Promise<Error>} The rejected promise
	 */
	(err: AxiosError): Promise<Error> => {
		const status = err.response?.status;
		const errorMessage = `Error executing Axios Request ${status ? getJiraErrorMessages(status) : err.message || ""}:\n${err.response?.data}`;
		const isWarning = status && (status >= 300 && status < 500 && status !== 400);

		// Log appropriate level depending on status - WARN: 300-499, ERROR: everything else
		// Log exception only if it is error, because AxiosError contains the request payload
		(isWarning ? logger.warn : logger.error)({ err, config: err.config }, errorMessage);

		return Promise.reject(new JiraClientError(errorMessage, err, status));
	};

/**
 * Middleware to enhance successful requests in Jira.
 *
 * @param {import("probot").Logger} logger - The probot logger instance
 */
const getSuccessMiddleware = (logger: Logger) =>
	/**
	 * DEBUG log the response info from Jira
	 *
	 * @param {import("axios").AxiosResponse} response - The response from axios
	 * @returns {import("axios").AxiosResponse} The axios response
	 */
	(response) => {
		logger.debug(
			{
				params: response.config.urlParams
			},
			`Jira request: ${response.config.method.toUpperCase()} ${
				response.config.originalUrl
			} - ${response.status} ${response.statusText}
				Response data: ${JSON.stringify(response.data)}`
		);

		return response;
	};

/**
 * Enrich the config object to include the time that the request started.
 *
 * @param {import("axios").AxiosRequestConfig} config - The Axios request configuration object.
 * @returns {import("axios").AxiosRequestConfig} The enriched config object.
 */
const setRequestStartTime = (config) => {
	config.requestStartTime = new Date();
	return config;
};

/**
 * Extract the path name from a URL.
 *
 */
export const extractPath = (someUrl = ""): string =>
	decodeURIComponent(url.parse(someUrl).pathname || "");

const RESPONSE_TIME_HISTOGRAM_BUCKETS = "100_1000_2000_3000_5000_10000_30000_60000";
/**
 * Submit statsd metrics on successful requests.
 *
 * @param {import("axios").AxiosResponse} response - The successful axios response object.
 * @returns {import("axios").AxiosResponse} The response object.
 */
const instrumentRequest = (response) => {
	if (!response) {
		return;
	}
	const requestDurationMs = Number(
		Date.now() - (response.config?.requestStartTime || 0)
	);
	const tags = {
		method: response.config?.method?.toUpperCase(),
		path: extractPath(response.config?.originalUrl),
		status: response.status
	};

	statsd.histogram(metricHttpRequest.jira, requestDurationMs, tags);
	tags["gsd_histogram"] = RESPONSE_TIME_HISTOGRAM_BUCKETS;
	statsd.histogram(metricHttpRequest.jira, requestDurationMs, tags);

	return response;
};

/**
 * Submit statsd metrics on failed requests.
 *
 * @param {import("axios").AxiosError} error - The Axios error response object.
 * @returns {Promise<Error>} a rejected promise with the error inside.
 */
const instrumentFailedRequest = (error) => {
	instrumentRequest(error?.response);
	return Promise.reject(error);
};

/**
 * Atlassian API JWTs need to be generated per-request due to their use of
 * Query String Hashing (QSH) to prevent URL tampering. Unlike traditional JWTs,
 * QSH requires us to re-encode a JWT for each URL we request to. As a result,
 * it makes sense for us to simply create a new JWT for each request rather than
 * attempt to reuse them. This accomplished using Axios interceptors to
 * just-in-time add the token to a request before sending it.
 */
export const getAxiosInstance = (
	baseURL: string,
	secret: string,
	logger?: Logger
): AxiosInstance => {
	logger = logger || getLogger("jira.client.axios");
	const instance = axios.create({
		baseURL,
		timeout: Number(process.env.JIRA_TIMEOUT) || 30000
	});

	// *** IMPORTANT: Interceptors are executed in reverse order. ***
	// the last one specified is the first to executed.

	instance.interceptors.request.use(setRequestStartTime);

	// This has to be the before any middleware that might change the URL
	// to generate the JWT token for Jira API correctly
	instance.interceptors.request.use(jiraAuthMiddleware(secret, instance));

	// URL params need to be at the bottom, after auth middle,
	// to generate the correct path before creating a JWT token based on it.
	instance.interceptors.request.use(urlParamsMiddleware);

	instance.interceptors.response.use(
		instrumentRequest,
		instrumentFailedRequest
	);

	instance.interceptors.response.use(
		getSuccessMiddleware(logger),
		getErrorMiddleware(logger)
	);

	return instance;
};

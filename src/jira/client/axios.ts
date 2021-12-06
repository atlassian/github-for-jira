import Logger from "bunyan";
import axios, { AxiosError, AxiosInstance } from "axios";

import url from "url";
import statsd from "../../config/statsd";
import { getLogger } from "../../config/logger";
import { metricHttpRequest } from "../../config/metric-names";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import {urlParamsMiddleware} from "../../util/axios/common-middleware";

const instance = process.env.INSTANCE_NAME;
const iss = `com.github.integration${instance ? `.${instance}` : ""}`;

// TODO: type hack to fix custom implementation of URL templating vars
declare module "axios" {
	interface AxiosRequestConfig {
		urlParams?: Record<string, string>;
	}
}

/**
 * Middleware to create a custom JWT for a request.
 *
 * @param {string} secret - The key to use to sign the JWT
 */
function getAuthMiddleware(secret: string) {
	return (
		/**
		 * @param {import("axios").AxiosRequestConfig} config - The config for the outgoing request.
		 * @returns {import("axios").AxiosRequestConfig} Updated axios config with authentication token.
		 */
		(config) => {
			const { query, pathname } = url.parse(config.url, true);

			const jwtToken = encodeSymmetric(
				{
					...getExpirationInSeconds(),
					iss,
					qsh: createQueryStringHash({
						method: config.method,
						pathname: pathname || undefined,
						query
					})
				},
				secret
			);

			return {
				...config,
				headers: {
					...config.headers,
					Authorization: `JWT ${jwtToken}`
				}
			};
		}
	);
}

/**
 * Wrapper for AxiosError, which includes error status
 */
export class JiraClientError extends Error {
	status?: number;
	cause: AxiosError

	constructor(message: string, cause: AxiosError, status?:number) {
		super(message);
		this.status = status

		//Remove config from the cause to prevent large payloads from being logged
		this.cause = {...cause, config: {}};
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
function getErrorMiddleware(logger: Logger) {
	return (
		/**
		 * Potentially enrich the promise's rejection.
		 *
		 * @param {import("axios").AxiosError} error - The error response from Axios
		 * @returns {Promise<Error>} The rejected promise
		 */
		(error: AxiosError): Promise<Error> => {

			const status = error?.response?.status;

			const errorMessage = "Error executing Axios Request " + (status ? getJiraErrorMessages(status) : error.message || "");

			const isWarning = status && (status >= 300 && status < 500 && status !== 400);

			// Log appropriate level depending on status - WARN: 300-499, ERROR: everything else
			// Log exception only if it is error, because AxiosError contains the request payload
			if (isWarning) {
				logger.warn(errorMessage)
			} else {
				logger.error({err: error}, errorMessage)
			}

			return Promise.reject(new JiraClientError(errorMessage, error, status));
		});
}

/**
 * Middleware to enhance successful requests in Jira.
 *
 * @param {import("probot").Logger} logger - The probot logger instance
 */
function getSuccessMiddleware(logger: Logger) {
	return (
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
		}
	);
}


/*
 * The Atlassian API uses JSON Web Tokens (JWT) for authentication along with
 * Query String Hashing (QSH) to prevent URL tampering. IAT, or issued-at-time,
 * is a Unix-style timestamp of when the token was issued. EXP, or expiration
 * time, is a Unix-style timestamp of when the token expires and must be no
 * more than three minutes after the IAT. Since our tokens are per-request and
 * short-lived, we use a timeout of 30 seconds.
 */
function getExpirationInSeconds() {
	const nowInSeconds = Math.floor(Date.now() / 1000);

	return {
		iat: nowInSeconds,
		exp: nowInSeconds + 30
	};
}

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
	url.parse(someUrl).pathname || "";

/**
 * Submit statsd metrics on successful requests.
 *
 * @param {import("axios").AxiosResponse} response - The successful axios response object.
 * @returns {import("axios").AxiosResponse} The response object.
 */
const instrumentRequest = (response) => {
	if(!response) {
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

	return response;
};

/**
 * Submit statsd metrics on failed requests.
 *
 * @param {import("axios").AxiosError} error - The Axios error response object.
 * @returns {Promise<Error>} a rejected promise with the error inside.
 */
const instrumentFailedRequest = () => {
	return (error) => {
		instrumentRequest(error?.response);
		return Promise.reject(error);
	};
};

/**
 * Atlassian API JWTs need to be generated per-request due to their use of
 * Query String Hashing (QSH) to prevent URL tampering. Unlike traditional JWTs,
 * QSH requires us to re-encode a JWT for each URL we request to. As a result,
 * it makes sense for us to simply create a new JWT for each request rather than
 * attempt to reuse them. This accomplished using Axios interceptors to
 * just-in-time add the token to a request before sending it.
 */
export default (
	baseURL: string,
	secret: string,
	logger?: Logger
): AxiosInstance => {
	logger = logger || getLogger("jira.client.axios");
	const instance = axios.create({
		baseURL,
		timeout: Number(process.env.JIRA_TIMEOUT) || 30000
	});

	instance.interceptors.request.use(setRequestStartTime);
	instance.interceptors.response.use(
		instrumentRequest,
		instrumentFailedRequest()
	);

	instance.interceptors.request.use(getAuthMiddleware(secret));
	instance.interceptors.request.use(urlParamsMiddleware);

	instance.interceptors.response.use(
		getSuccessMiddleware(logger),
		getErrorMiddleware(logger)
	);

	return instance;
};

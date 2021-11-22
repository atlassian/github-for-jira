import { GithubClientError, RateLimitingError } from "./errors";
import Logger from "bunyan";
import url from "url";
import statsd from "../../config/statsd";

/**
 * Extract the path name from a URL.
 */
const extractPath = (someUrl = ""): string =>
	url.parse(someUrl).pathname || "";

const RESPONSE_TIME_HISTOGRAM_BUCKETS =	"100_1000_2000_3000_5000_10000_30000_60000";

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

const sendResponseMetrics = (response, metricName: string, status?: string | number) => {
	status = `${status || response.status}`;
	const requestDurationMs = Number(
		Date.now() - (response.config?.requestStartTime || 0)
	);

	// using client tag to separate GH client from Octokit
	const tags = {
		client: "axios",
		method: response.config?.method?.toUpperCase(),
		path: extractPath(response.config?.originalUrl),
		status: status
	};

	statsd.histogram(metricName, requestDurationMs, tags);
	tags["gsd_histogram"] = RESPONSE_TIME_HISTOGRAM_BUCKETS;
	statsd.histogram(metricName, requestDurationMs, tags);
	return response;
}


export const instrumentRequest = (metricName) => 
	(response) => {
		if(!response) {
			return;
		}
		return sendResponseMetrics(response, metricName);
	};

/**
 * Submit statsd metrics on failed requests.
 *
 * @param {import("axios").AxiosError} error - The Axios error response object.
 * @param metricName - Name for the response metric
 * @returns {Promise<Error>} a rejected promise with the error inside.
 */
export const instrumentFailedRequest = (metricName) =>
	(error) => {
		if(error instanceof RateLimitingError) {
			sendResponseMetrics(error.cause?.response, metricName, "rateLimiting")
		} else if(error instanceof GithubClientError) {
			sendResponseMetrics(error.cause?.response, metricName);
		} else {
			sendResponseMetrics(error.response, metricName)
		}
		
		return Promise.reject(error);
	};


export const handleFailedRequest = (logger: Logger) => 
	(error) => {
		if(error.response) {
			const status = error.response?.status;
			const errorMessage = `Error executing Axios Request ` + error.message;

			if(error.headers?.["X-RateLimit-Remaining"] == "0" && error.headers?.["X-RateLimit-Reset"])
			{
				logger.warn({ err: error }, "Rate limiting error");
				const rateLimitReset: number = parseInt(error.headers["X-RateLimit-Reset"]);
				return Promise.reject(new RateLimitingError(rateLimitReset, error, status));
			}

			if (status === 403)
			{
				logger.warn({ err: error }, "Github returned 403 without ratelimit header");
				return Promise.reject(new RateLimitingError(new Date().getTime() / 1000 + 60 * 60, error, status));
			}
			
			const isWarning = status && (status >= 300 && status < 500 && status !== 400);
			
			isWarning? logger.warn(errorMessage) : logger.error({err: error}, errorMessage);
			return Promise.reject(new GithubClientError(errorMessage, error, status));
		}
		return Promise.reject(error);
	}

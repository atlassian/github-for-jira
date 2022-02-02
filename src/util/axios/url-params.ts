import { AxiosRequestConfig } from "axios";
import { getLogger } from "../../config/logger";

declare module "axios" {
	interface AxiosRequestConfig {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		urlParams?: Record<string, any>;
		originalUrl?: string;
	}
}

const logger = getLogger("url-params");
/**
 * Enrich the Axios Request Config with a URL object.
 *
 * @param {import("axios").AxiosRequestConfig} config - The outgoing request configuration.
 * @returns {import("axios").AxiosRequestConfig} The enriched axios request config.
 */
export const urlParamsMiddleware = (config: AxiosRequestConfig) => {
	config.originalUrl = config.url;
	if (!config.url?.length) {
		return config;
	}

	Object.entries(config.urlParams || {})
		.forEach(([k, v]) => {
			if(!k || !v?.toString) {
				logger.error({ k, v, config }, "Cannot use undefined or unstringable key or value for URL Params");
				return;
			}
			const key = `:${k}`;
			const value = encodeURIComponent(v.toString());
			if (!value || !config.url?.includes(key)) {
				logger.error({ key, value, config }, "URL Param doesn't exist in url path - ignoring");
				return;
			}

			config.url = config.url?.replace(key, value);
		});

	return config;
};

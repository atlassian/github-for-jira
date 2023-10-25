import { AxiosRequestConfig } from "axios";
import { getLogger } from "config/logger";

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
export const urlParamsMiddleware = (config: AxiosRequestConfig): AxiosRequestConfig => {
	const uri = () => `${config.baseURL || ""}${config.url || ""}`;
	// If uri is empty and there's no url params, just skip this middleware
	if (!uri()?.length) {
		return config;
	}

	// Save original Url for future reference
	config.originalUrl = uri();

	Object.entries(config.urlParams || {})
		.forEach(([k, v]) => {
			if (!k || !v || !String(v)) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				logger.error({ k, v, config }, "Cannot use undefined or an unstringable key/value for URL Params");
				return;
			}
			const key = `{${k}}`;
			const value = encodeURIComponent(String(v));
			if (!value.length || !uri()?.includes(key)) {
				logger.error({ key, value, config }, "URL Param doesn't exist in url path - ignoring");
				return;
			}

			// use split/join method to replace all values since String.replace only
			// does one at a time.
			config.url = config.url?.split(key).join(value);
			config.baseURL = config.baseURL?.split(key).join(value);
		});

	// Throw error if there are still some replacements to be made
	const matches = uri().match(/\{([\s\w]*)\}/g);
	if (matches?.length) {
		throw new Error("Missing substitutions from URL Params: " + matches.map(v => v.slice(1, -1)).join(","));
	}

	return config;
};

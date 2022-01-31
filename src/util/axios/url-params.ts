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
	const { url } = config;
	config.originalUrl = url;
	if (!url?.length) {
		return config;
	}

	Object.entries(config.urlParams || {})
		.filter(([k, v]) => !!k && !!v?.toString)
		.forEach(([k, v]) => {
			const key = `:${k}`;
			const value = encodeURIComponent(v.toString());
			if (!value || !url.includes(key)) {
				logger.error({ key, value, config }, "URL Param doesn't exist in url path - ignoring");
				return;
			}

			config.url = url.replace(key, value);
		});

	return config;
};

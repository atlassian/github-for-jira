import url from "url";

/**
 * Enrich the Axios Request Config with a URL object.
 * TODO: non-standard and probably should be done through string interpolation
 *
 * @param {import("axios").AxiosRequestConfig} config - The outgoing request configuration.
 * @returns {import("axios").AxiosRequestConfig} The enriched axios request config.
 */
export const urlParamsMiddleware = (config) => {
	// eslint-disable-next-line prefer-const
	let { query, pathname, ...rest } = url.parse(config.url, true);
	config.urlParams = config.urlParams || {};

	for (const param in config.urlParams) {
		if (pathname?.includes(`:${param}`)) {
			pathname = pathname.replace(`:${param}`, config.urlParams[param]);
		} else {
			query[param] = config.urlParams[param];
		}
	}

	config.urlParams.baseUrl = config.baseURL;

	return {
		...config,
		originalUrl: config.url,
		url: url.format({
			...rest,
			pathname,
			query
		})
	};
}

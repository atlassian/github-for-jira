import { Request } from "express";

/**
 * This method creates a URL with queryParameters that are available within the request
 * It will add all the available query parameters as queryString within the URL
 *
 * @param req
 * @param URL
 */
export const createUrlWithQueryString = (req: Request, URL: string): string => {
	let queryString = "";
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	const keys = req.query ? Object.keys(req.query) : [];
	const queryStrings = keys.reduce((_, current, index, array) => {
		if (req.query[current]) {
			queryString += index === 0 ? "?" : "";
			queryString += current + "=";
			queryString += String(req.query[current]);
			queryString += index !== array.length - 1 ? "&" : "";
		}
		return queryString;
	}, "");

	return URL + queryStrings;
};

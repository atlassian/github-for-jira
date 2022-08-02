import { Request } from "express";

/**
 * This method creates a URL with queryParameters that are available within the request
 * It firstly checks if the passed Request `req` has the query parameters defined in the array `keys`
 * And will add the query parameters as queryString within the URL
 *
 * @param req
 * @param URL
 * @param keys
 */
export const checkAndAddQueryString = (req: Request, URL: string, keys: string[]): string => {
	let queryString = "";

	return encodeURIComponent(URL + keys.reduce((_, current, index, array) => {
		if (req.query[current]) {
			queryString += index === 0 ? "?" : "";
			queryString += current + "=" + req.query[current];
			queryString += index !== array.length - 1 ? "&" : "";
		}
		return queryString;
	}, ""));
};

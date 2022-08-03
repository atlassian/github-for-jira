import matchstick from "matchstick";

/**
 * This method checks if the `route` matches the `pattern`
 * It ignores all the query strings in both `route` and `pattern`
 *
 * Source: https://github.com/edj-boston/matchstick
 *
 */
export const matchRouteWithPattern = (pattern: string, route: string): boolean => {
	pattern = pattern.replace(/ac\./gm, ""); // Remove all the `ac.`
	pattern = pattern.split("?")[0]; // Removing the query parameters
	route = route.split("?")[0]; // Removing the query parameters

	return matchstick(pattern, "template").match(route);
};
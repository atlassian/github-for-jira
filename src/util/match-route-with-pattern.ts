import matchstick from "matchstick";
import { isEmpty } from "lodash";

/**
 * This method checks if the `route` matches the `pattern`
 * It ignores all the query strings in both `route` and `pattern`
 *
 * Source: https://github.com/edj-boston/matchstick
 *
 */
export const matchRouteWithPattern = (pattern: string, route: string): boolean => {
	if (isEmpty(pattern) || isEmpty(route)) {
		return false;
	}
	pattern = pattern.replace(/ac\./g, ""); // Remove all the `ac.`
	pattern = pattern.split("?")[0]; // Removing the query parameters
	route = route.split("?")[0]; // Removing the query parameters

	// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
	return matchstick(pattern, "template").match(route);
};

/*
 * An error wrapper that provides a more specific message for failed requests to the Jira API.
 */
import { AxiosError, AxiosResponse } from "axios";

export default class JiraClientError extends Error {
	response: AxiosResponse;

	constructor(error: AxiosError) {
		const message = "Error communicating with Jira DevInfo API";

		super(message);

		this.response = error.response;
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}

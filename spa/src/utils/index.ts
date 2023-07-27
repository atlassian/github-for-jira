import { ErrorType } from "../../../src/rest-interfaces/oauth-types";
import { AxiosError } from "axios";
import React from "react";

export type ErrorObjType = {
	type: ErrorType,
	message: string | React.JSX.Element;
}

export const getJiraJWT = (): Promise<string> => new Promise(resolve => {
	return AP.context.getToken((token: string) => {
		resolve(token);
	});
});
export const modifyError = (error: AxiosError): ErrorObjType => {
	const message = (error?.response?.data || error.message) as string;
	const errorObj = { type: "error" as ErrorType };
	const warningObj = { type: "warning" as ErrorType };

	// TODO: map backend errors in frontend
	if (message.includes("Blocked by GitHub allowlist")) {
		return {
			...warningObj,
			message: `<>
				<Heading level="h500">GitHub for Jira is blocked by your IP allowlist</Heading>
				<p>Your GitHub organization only allows access to some IP addresses. To view development work in Jira, you need to add GitHub for Jira’s IP addresses to your allowlist.</p><br />
				<a href="">Learn how to add GitHub for Jira to your IP allowlist</a>
			</>`
		};
	} else if (message.includes("Rate limiting error")) {
		return { ...errorObj, message: "GitHub rate limiting" };
	} else if (message.includes("SSO Login required")) {
		return { ...errorObj, message: "GitHub SSO login required" };
	} else if (message.includes("Resource not accessible by integration")) {
		return { ...errorObj, message: "Forbidden" };
	} else {
		return { ...errorObj, message: "Something went wrong and we couldn’t connect to GitHub, try again." };
	}
};

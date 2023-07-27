import { AxiosError } from "axios";
import { ErrorType } from "../../../src/rest-interfaces/oauth-types";
import React from "react";
import Heading from "@atlaskit/heading";
import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";

export type ErrorObjType = {
	type: ErrorType,
	message: string | React.JSX.Element;
}

export const modifyError = (error: AxiosError): ErrorObjType => {
	const Paragraph = styled.p`
		color: ${token("color.text.subtle")};
	`;
	const message = (error?.response?.data || error.message) as string;
	const errorObj = { type: "error" as ErrorType };
	const warningObj = { type: "warning" as ErrorType };

	// TODO: map backend errors in frontend
	if (message.includes("Blocked by GitHub allowlist")) {
		return {
			...warningObj,
			message: <>
				<Heading level="h500">GitHub for Jira is blocked by your IP allowlist</Heading>
				<Paragraph>
					Your GitHub organization only allows access to some IP addresses. To view<br />
					development work in Jira, you need to add GitHub for Jira’s IP addresses to<br />
					your allowlist.
				</Paragraph>
				<br />
				<a target="_blank" href="https://github.com/atlassian/github-for-jira/blob/main/docs/ip-allowlist.md">Learn how to add GitHub for Jira to your IP allowlist</a>
			</>
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

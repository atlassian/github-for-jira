import { AxiosError } from "axios";
import { ErrorType, ApiError, ErrorCode } from "rest-interfaces";
import React, { MouseEvent } from "react";
import Heading from "@atlaskit/heading";
import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";

export type ErrorObjType = {
	type: ErrorType,
	message: string | React.JSX.Element;
}

type SimpleError = {
	message: string;
}

type ErrorWithErrorCode = {
	errorCode: ErrorCode
};

const GENERIC_MESSAGE = "Something went wrong, please try again later.";

export const modifyError = (
  error: AxiosError<ApiError> | SimpleError | ErrorWithErrorCode,
  context: { orgLogin?: string; },
  callbacks: { onClearGitHubToken: (e: MouseEvent<HTMLAnchorElement>) => void }
): ErrorObjType => {

	const Paragraph = styled.p`
		color: ${token("color.text.subtle")};
	`;
	const errorObj = { type: "error" as ErrorType };
	const warningObj = { type: "warning" as ErrorType };
	let errorCode: ErrorCode = "UNKNOWN";
	if (error instanceof AxiosError) {
		errorCode = error?.response?.data?.errorCode || "UNKNOWN";
	} else if ((error as ErrorWithErrorCode).errorCode) {
		errorCode = (error as ErrorWithErrorCode).errorCode;
	} else {
		errorCode = "UNKNOWN";
	}

	// TODO: map all of the remaining backend errors in frontend
	if (errorCode === "IP_BLOCKED") {
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
	} else if (errorCode === "INSUFFICIENT_PERMISSION") {
		return { ...errorObj, message: `You are not Admin of the target org ${context.orgLogin || ""}. Please make sure you are admin of the org and try again.` }; //TODO: Better message
	} else if (errorCode === "TIMEOUT") {
		return { ...errorObj, message: "Request timeout. Please try again later." }; //TODO: Better message
	} else if (errorCode === "RATELIMIT") {
		return { ...errorObj, message: "GitHub rate limit exceeded. Please try again later." }; //TODO: Better message
	} else if (errorCode === "SSO_LOGIN") {
		//TODO: Shall we merge these two steps into one and clear token during the redirect to SSO?
		return {
			...warningObj,
			message: <>
				<Heading level="h500">SSO Login required</Heading>
				<Paragraph>
					You cannot connect to this organization because you are not currently logged in through your SSO in GitHub.
					<br></br>
					Please follow the following steps:
					<ol>
						<li>
							Please go to the <a target="_blank" href={`https://github.com/organizations/${context?.orgLogin}/settings/profile`}> organization settings</a> page and make sure you have admin access there.
						</li>
						<li>
							Please click <a href="" onClick={callbacks.onClearGitHubToken}>this link</a> to reset your token. This will allow you to connect to this organization.
						</li>
					</ol>
				</Paragraph>
			</>
		};
	} else if (errorCode === "INVALID_TOKEN") {
		return {
			...warningObj,
			message: <>
				<span>"The GitHub token seems invalid, please <a href="" onClick={callbacks.onClearGitHubToken}>re-authorise</a> and try again."</span>
			</>
		};
	} else {
		return { ...errorObj, message: GENERIC_MESSAGE };
	}
};

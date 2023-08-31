import { ErrorType } from "rest-interfaces";
import React, { MouseEvent } from "react";
import { ErrorForIPBlocked, ErrorForNonAdmins, ErrorForSSO } from "../components/Error/KnownErrors";
import { toErrorCode, ErrorCode } from "../services";

export type ErrorObjType = {
	type: ErrorType,
	message: string | React.JSX.Element;
	errorCode: ErrorCode
}

const GENERIC_MESSAGE = "Something went wrong and we couldn’t connect to GitHub, try again.";

export const GENERIC_MESSAGE_WITH_LINK = <>
	<p>Something went wrong and we couldn’t connect to GitHub, try again.</p>
	<p><a href="https://support.atlassian.com/contact/" target="_blank">Contact Support</a></p>
	</>;

export const modifyError = (
  error: unknown,
  context: { orgLogin?: string; },
  callbacks: { onClearGitHubToken: (e: MouseEvent<HTMLAnchorElement>) => void; onRelogin: () => void }
): ErrorObjType => {
	let errorCode: ErrorCode = toErrorCode(error);
	return getErrorUI(errorCode, context, callbacks);
}

export const getErrorUI = (
  errorCode: ErrorCode,
  context: { orgLogin?: string; },
  callbacks: { onClearGitHubToken: (e: MouseEvent<HTMLAnchorElement>) => void; onRelogin: () => void }
): ErrorObjType => {
	const errorObj = { type: "error" as ErrorType };
	const warningObj = { type: "warning" as ErrorType };

	// TODO: map all of the remaining backend errors in frontend
	if (errorCode === "IP_BLOCKED") {
		return {
			...warningObj,
			errorCode,
			message: <ErrorForIPBlocked resetCallback={callbacks.onRelogin} orgName={context.orgLogin} />
		};
	}  else if (errorCode === "SSO_LOGIN") {
		// TODO: Update this to support GHE
		const accessUrl = `https://github.com/organizations/${context.orgLogin}/settings/profile`;

		return {
			...warningObj,
			errorCode,
			message: <>
				<ErrorForSSO accessUrl={accessUrl} resetCallback={callbacks.onRelogin} orgName={context.orgLogin} />
			</>
		};
	} else if (errorCode === "INSUFFICIENT_PERMISSION") {
		return {
			...warningObj,
			errorCode,
			message: <ErrorForNonAdmins orgName={context.orgLogin} />
		};
	} else if (errorCode === "TIMEOUT") {
		return { ...errorObj, errorCode, message: "Request timeout. Please try again later." };
	} else if (errorCode === "RATELIMIT") {
		return { ...errorObj, errorCode,  message: "GitHub rate limit exceeded. Please try again later." };
	} else if (errorCode === "INVALID_TOKEN") {
		return {
			...errorObj,
			errorCode,
			message: <>
				<span>GitHub token seems invalid, please <a href="" onClick={callbacks.onClearGitHubToken}>login again</a>.</span>
			</>
		};
	} else {
		return { ...errorObj, errorCode, message: GENERIC_MESSAGE };
	}
};

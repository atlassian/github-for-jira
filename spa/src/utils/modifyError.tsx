import { AxiosError } from "axios";
import { ErrorType, ApiError, ErrorCode } from "rest-interfaces";
import React, { MouseEvent } from "react";
import { ErrorForIPBlocked, ErrorForNonAdmins, ErrorForSSO } from "../components/Error/KnownErrors";

export type ErrorObjType = {
	type: ErrorType,
	message: string | React.JSX.Element;
	errorCode: ErrorCode
}

type SimpleError = {
	message: string;
}

type ErrorWithErrorCode = {
	errorCode: ErrorCode
};

const GENERIC_MESSAGE = "Something went wrong and we couldn’t connect to GitHub, try again.";

export const GENERIC_MESSAGE_WITH_LINK = <>
	<p>Something went wrong and we couldn’t connect to GitHub, try again.</p>
	<p><a href="https://support.atlassian.com/contact/" target="_blank">Contact Support</a></p>
</>;

export const modifyError = (
  error: AxiosError<ApiError> | SimpleError | ErrorWithErrorCode,
  context: { orgLogin?: string; },
	callbacks: {
		onClearGitHubToken: (e: MouseEvent<HTMLAnchorElement>) => void;
		onRelogin: () => void;
		onPopupBlocked: () => void;
	}
): ErrorObjType => {
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
				<ErrorForSSO accessUrl={accessUrl} resetCallback={callbacks.onRelogin} orgName={context.orgLogin} onPopupBlocked={callbacks.onPopupBlocked} />
			</>
		};
	} else if (errorCode === "INSUFFICIENT_PERMISSION") {
		// TODO: Update this to support GHE
		const adminOrgsUrl = `https://github.com/orgs/${context.orgLogin}/people?query=role%3Aowner`;

		return {
			...warningObj,
			errorCode,
			message: <ErrorForNonAdmins orgName={context.orgLogin} adminOrgsUrl={adminOrgsUrl} />
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

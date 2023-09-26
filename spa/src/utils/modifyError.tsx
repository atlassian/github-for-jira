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

export type ErrorWithErrorCode = {
	errorCode: ErrorCode;
};


export class CustomError extends Error {
    public errorCode: string;
    constructor(error: ErrorWithErrorCode) {
        super("messages custm ");
        this.name = "name custm";
        this.errorCode = error.errorCode;
        Object.setPrototypeOf(this, CustomError.prototype);
    }
}

const GENERIC_MESSAGE = "Something went wrong and we couldn’t connect to GitHub, try again.";

export const GENERIC_MESSAGE_WITH_LINK = <>
	<p>Something went wrong and we couldn’t connect to GitHub, try again.</p>
	<p><a href="https://support.atlassian.com/contact/" target="_blank">Contact Support</a></p>
</>;

export const modifyError = (
	error: AxiosError<ApiError> | SimpleError | ErrorWithErrorCode,
	context: { orgLogin?: string },
	callbacks: {
		onClearGitHubToken: (e: MouseEvent<HTMLAnchorElement>) => void;
		onRelogin: () => void;
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
	const accessUrl = `https://github.com/organizations/${context.orgLogin}/settings/profile`;
	const adminOrgsUrl = `https://github.com/orgs/${context.orgLogin}/people?query=role%3Aowner`;
	let result;
	// TODO: map all of the remaining backend errors in frontend
	switch (errorCode) {
		case "POPUP_BLOCKED":
			// TODO: Update this to support GHE
			result =  {
				...errorObj,
				errorCode,
				message: "If you are not redirected to GitHub’s page in a new tab, please enable pop-ups for this site.",
			};
			break;
		case "IP_BLOCKED":
			result = {
				...warningObj,
				errorCode,
				message: (
					<ErrorForIPBlocked
						resetCallback={callbacks.onRelogin}
						orgName={context.orgLogin}
					/>
				),
			};
			break;
		case "SSO_LOGIN":
			// TODO: Update this to support GHE
			result = {
				...warningObj,
				errorCode,
				message: (
					<>
						<ErrorForSSO
							accessUrl={accessUrl}
							resetCallback={callbacks.onRelogin}
							orgName={context.orgLogin}
						/>
					</>
				),
			};
			break;
		case "INSUFFICIENT_PERMISSION":
			// TODO: Update this to support GHE
			result = {
				...warningObj,
				errorCode,
				message: (
					<ErrorForNonAdmins
						orgName={context.orgLogin}
						adminOrgsUrl={adminOrgsUrl}
					/>
				),
			};
			break;
		case "TIMEOUT":
			result = {
				...errorObj,
				errorCode,
				message: "Request timeout. Please try again later.",
			};
			break;
		case "RATELIMIT":
			result = {
				...errorObj,
				errorCode,
				message: "GitHub rate limit exceeded. Please try again later.",
			};
			break;

		case "INVALID_TOKEN":
			result = {
				...errorObj,
				errorCode,
				message: (
					<>
						<span>
							GitHub token seems invalid, please{" "}
							<a href="" onClick={callbacks.onClearGitHubToken}>
								login again
							</a>
							.
						</span>
					</>
				),
			};
			break;

		default:
			result = { ...errorObj, errorCode, message: GENERIC_MESSAGE };
			break;
	}
	return result;
};

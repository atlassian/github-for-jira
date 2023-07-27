import { Request, Response, NextFunction } from "express";
import { ApiError, ErrorCode } from "rest-interfaces";
import { RestApiError } from "config/errors";
import * as GH from "~/src/github/client/github-client-errors";

/*eslint-disable @typescript-eslint/no-explicit-any */
export const RestErrorHandler = (err: any, req: Request, res: Response<ApiError>, _next: NextFunction) => {

	logErrorOrWarning(err, req);

	if (err instanceof RestApiError) {
		res.status(err.httpStatus).json({
			httpStatus: err.httpStatus,
			errorCode: err.errorCode,
			message: err.message
		});
		return;
	}

	if (err instanceof GH.GithubClientError) {
		const mapped = mapGitHubError(err);
		res.status(mapped.httpStatus).json(mapped);
		return;
	}

	res.status(500).json({
		httpStatus: 500,
		message: "Unknown Error",
		errorCode: ErrorCode.UNKNOWN
	});

};

const logErrorOrWarning = (err: any, req: Request) => {

	const httpStatus = parseInt(err.status) || parseInt(err.httpStatus) || 500;

	if (httpStatus >= 500) {
		req.log.error({ err }, "Error happen during rest api");
	} else {
		req.log.warn({ err }, "Error happen during rest api");
	}

};

const mapGitHubError = (err: GH.GithubClientError): ApiError => {

	let httpStatus: number;
	let errorCode: ErrorCode;

	if (err instanceof GH.GithubClientTimeoutError) {
		httpStatus = 500;
		errorCode = ErrorCode.TIMEOUT;
	} else if (err instanceof GH.GithubClientRateLimitingError) {
		httpStatus = 400;
		errorCode = ErrorCode.RATELIMIT;
	} else if (err instanceof GH.GithubClientBlockedIpError) {
		httpStatus = 400;
		errorCode = ErrorCode.IP_BLOCKED;
	} else if (err instanceof GH.GithubClientSSOLoginError) {
		httpStatus = 400;
		errorCode = ErrorCode.SSO_LOGIN;
	} else if (err instanceof GH.GithubClientInvalidPermissionsError) {
		httpStatus = 401;
		errorCode = ErrorCode.INSUFFICIENT_PERMISSION;
	} else if (err instanceof GH.GithubClientNotFoundError) {
		httpStatus = 404;
		errorCode = ErrorCode.RESOURCE_NOT_FOUND;
	} else if (err instanceof GH.GithubClientGraphQLError) {
		httpStatus = 500;
		errorCode = ErrorCode.UNKNOWN; //For generic graphql errorCode, nothing we can do for the UI so set it unknown
	} else {
		httpStatus = 500;
		errorCode = ErrorCode.UNKNOWN;
	}

	return {
		httpStatus,
		errorCode,
		message: err.message
	};

};

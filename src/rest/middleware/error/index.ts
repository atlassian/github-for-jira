import { Request, Response, NextFunction } from "express";
import { ApiError } from "rest-interfaces";
import { RestApiError } from "config/errors";
import * as GH from "~/src/github/client/github-client-errors";

/*eslint-disable @typescript-eslint/no-explicit-any */
export const RestErrorHandler = (err: Error, req: Request, res: Response<ApiError>, _next: NextFunction) => {

	logErrorOrWarning(err, req);

	const reqTraceId = (res.locals as { reqTraceId: string }).reqTraceId;

	if (err instanceof RestApiError) {
		res.status(err.httpStatus).json({
			reqTraceId,
			errorCode: err.errorCode,
			message: err.message
		});
		return;
	}

	if (err instanceof GH.GithubClientError) {
		res.status(err.status || 500).json({
			reqTraceId,
			errorCode: err.uiErrorCode,
			message: err.message
		});
		return;
	}

	res.status(500).json({
		reqTraceId,
		message: "Unknown Error",
		errorCode: "UNKNOWN"
	});

};

const logErrorOrWarning = (err: Error, req: Request) => {

	const httpStatus = parseInt(err["status"] as string ?? "") || parseInt(err["httpStatus"] as string ?? "") || 500;
	const extraInfo = {
		httpStatus,
		method: req.method,
		path: req.path,
		base: req.baseUrl
	};
	if (httpStatus >= 500) {
		req.log.error({ err, ...extraInfo }, "Error happen during rest api");
	} else {
		req.log.warn({ err, ...extraInfo }, "Error happen during rest api");
	}

};

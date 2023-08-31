import type { ApiErrorCode } from "rest-interfaces";
import { AxiosError } from "axios";

export type ErrorCode = ApiErrorCode
	| "ERR_GITHUB_TOKEN_EMPTY"
	| "ERR_RESP_STATUS_NOT_200"
	| "ERR_OAUTH_CODE_EMPTY"
	| "ERR_OAUTH_STATE_EMPTY"
	| "ERR_OAUTH_STATE_INVALID"
	| "ERR_OAUTH_TOKEN_ACQUIRE_FAILURE";

export type Result<T> = {
	success: true,
	data: T
} | {
	success: false,
	errCode: ErrorCode
};

type ErrorWithErrorCode = {
	errorCode: ErrorCode
};

export function toErrorCode(error: unknown): ErrorCode {
	if (error instanceof AxiosError) {
		return error?.response?.data?.errorCode || "UNKNOWN";
	} else if ((error as ErrorWithErrorCode).errorCode) {
		return (error as ErrorWithErrorCode).errorCode;
	} else {
		return "UNKNOWN";
	}
}

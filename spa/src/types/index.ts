import type { ApiErrorCode } from "rest-interfaces";

export type ErrorCode = ApiErrorCode | "ERR_GITHUB_TOKEN_EMPTY";

export type Result<T> = {
	success: true,
	data: T
} | {
	success: false,
	errCode: ErrorCode
};

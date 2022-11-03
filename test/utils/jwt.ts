import { encodeSymmetric, createQueryStringHash, Request } from "atlassian-jwt";

export const buildContextTypeJWTToken = (shareSecret: string) => {
	return encodeSymmetric({
		iss: "jira",
		qsh: "context-qsh"
	}, shareSecret);
};

export const buildQueryTypeJWTToken = (
	shareSecret: string,
	req: Request
) => {
	return encodeSymmetric({
		iss: "jira",
		qsh: createQueryStringHash({ ... req })
	}, shareSecret);
};

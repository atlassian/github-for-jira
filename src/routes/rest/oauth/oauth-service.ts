import { GetRedirectUrlResponse } from "rest-interfaces/oauth-types";

/* eslint-disable @typescript-eslint/no-unused-vars */
export const getRedirectUrl = async (_jiraHost: string): Promise<GetRedirectUrlResponse> => {
	return {
		redirectUrl: "hello"
	};
};

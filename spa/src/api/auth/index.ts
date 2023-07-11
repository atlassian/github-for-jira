import { GetRedirectUrlResponse, ExchangeTokenResponse } from "../../rest-interfaces/oauth-types";
import AxiosInstance from "../axiosInstance";
import { AxiosResponse } from "axios";

const GitHubAuth = {
	generateOAuthUrl: async (): Promise<AxiosResponse<GetRedirectUrlResponse>> => AxiosInstance.get("/rest/app/cloud/oauth/redirectUrl"),
	exchangeToken: async (code: string, state: string): Promise<AxiosResponse<ExchangeTokenResponse>> => {
		return AxiosInstance.post<ExchangeTokenResponse>("/rest/app/cloud/oauth/exchangeToken", {
			code, state
		});
	}
};

export default GitHubAuth;

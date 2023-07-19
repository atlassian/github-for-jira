import { GetRedirectUrlResponse, ExchangeTokenResponse } from "../../rest-interfaces/oauth-types";
import { AxiosInstanceWithJWT } from "../axiosInstance";
import { AxiosResponse } from "axios";

const GitHubAuth = {
	generateOAuthUrl: (): Promise<AxiosResponse<GetRedirectUrlResponse>> => AxiosInstanceWithJWT.get("/rest/app/cloud/oauth/redirectUrl"),
	exchangeToken: (code: string, state: string): Promise<AxiosResponse<ExchangeTokenResponse>> =>
		AxiosInstanceWithJWT.post<ExchangeTokenResponse>("/rest/app/cloud/oauth/exchangeToken", { code, state })
};

export default GitHubAuth;

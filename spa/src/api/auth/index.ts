import { GetRedirectUrlResponse, ExchangeTokenResponse } from "rest-interfaces";
import { axiosRestWithNoJwt } from "../axiosInstance";

export default {
	generateOAuthUrl: () => axiosRestWithNoJwt.get<GetRedirectUrlResponse>("/rest/app/cloud/oauth/redirectUrl"),
	exchangeToken: (code: string, state: string) => axiosRestWithNoJwt.post<ExchangeTokenResponse>("/rest/app/cloud/oauth/exchangeToken", { code, state }),
};

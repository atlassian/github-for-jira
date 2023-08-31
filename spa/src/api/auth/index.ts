import { GetRedirectUrlResponse, ExchangeTokenResponse } from "rest-interfaces";
import { axiosRest } from "../axiosInstance";

export default {
	generateOAuthUrl: () => axiosRest.get<GetRedirectUrlResponse>("/rest/app/cloud/oauth/redirectUrl"),
	exchangeToken: (code: string, state: string) => axiosRest.post<ExchangeTokenResponse>("/rest/app/cloud/oauth/exchangeToken", { code, state }),
};

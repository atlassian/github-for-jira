import { GetRedirectUrlResponse } from "../../rest-interfaces/oauth-types";
import AxiosInstance from "../axiosInstance";
import { AxiosResponse } from "axios";

const GitHubAuth = {
	authenticate: (): Promise<AxiosResponse<GetRedirectUrlResponse>> => AxiosInstance.get("/rest/app/cloud/oauth/redirectUrl")
};

export default GitHubAuth;

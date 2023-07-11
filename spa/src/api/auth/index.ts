import AxiosInstance from "../axiosInstance";
import { AxiosResponse } from "axios";

const GitHubAuth = {
	authenticate: (): Promise<AxiosResponse> => AxiosInstance.get("/rest/app/cloud/oauth/redirectUrl")
};

export default GitHubAuth;

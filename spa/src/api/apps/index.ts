import { GetGitHubAppsUrlResponse } from "../../rest-interfaces/oauth-types";
import AxiosInstance from "../axiosInstance";
import { AxiosResponse } from "axios";

const GitHubApps = {
	getAppNewInstallationUrl: async (): Promise<AxiosResponse<GetGitHubAppsUrlResponse>> => AxiosInstance.get("/rest/app/cloud/installation/new"),
};

export default GitHubApps;

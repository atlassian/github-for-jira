import { GetGitHubAppsUrlResponse } from "../../rest-interfaces/oauth-types";
import { AxiosInstanceWithJWT } from "../axiosInstance";
import { AxiosResponse } from "axios";

const GitHubApps = {
	getAppNewInstallationUrl: async (): Promise<AxiosResponse<GetGitHubAppsUrlResponse>> => AxiosInstanceWithJWT.get("/rest/app/cloud/installation/new"),
};

export default GitHubApps;

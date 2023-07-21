import { GetGitHubAppsUrlResponse } from "../../rest-interfaces/oauth-types";
import { axiosRest } from "../axiosInstance";

export default {
	getAppNewInstallationUrl: () => axiosRest.get<GetGitHubAppsUrlResponse>("/rest/app/cloud/installation/new"),
};


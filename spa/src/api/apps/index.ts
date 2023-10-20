import {
	DeferredInstallationUrlParams,
	GetDeferredInstallationUrl,
	GetGitHubAppsUrlResponse,
	JiraCloudIDResponse
} from "rest-interfaces";
import { axiosRest } from "../axiosInstance";

export default {
	getDeferredInstallationUrl: (params: DeferredInstallationUrlParams) =>
		axiosRest.get<GetDeferredInstallationUrl>("/rest/app/cloud/deferred-installation-url", { params }),
	getAppNewInstallationUrl: () => axiosRest.get<GetGitHubAppsUrlResponse>("/rest/app/cloud/installation/new"),
	getJiraCloudId: () => axiosRest.get<JiraCloudIDResponse>("/rest/app/cloud/jira/cloudid"),
};


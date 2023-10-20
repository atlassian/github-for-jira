import { GetGitHubAppsUrlResponse, JiraCloudIDResponse } from "rest-interfaces";
import { axiosRest } from "../axiosInstance";

export default {
	getAppNewInstallationUrl: () => axiosRest.get<GetGitHubAppsUrlResponse>("/rest/app/cloud/installation/new"),
	getJiraCloudId: () => axiosRest.get<JiraCloudIDResponse>("/rest/app/cloud/jira/cloudid"),
};


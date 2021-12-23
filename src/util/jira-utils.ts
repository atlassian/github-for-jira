import envVars from "../config/env";
import axios from "axios";

export const getJiraAppUrl = (jiraHost: string): string =>
	jiraHost?.length ? `${jiraHost}/plugins/servlet/ac/com.github.integration.${envVars.INSTANCE_NAME}/github-post-install-page` : "";

export const getJiraMarketplaceUrl = (jiraHost: string): string =>
	jiraHost?.length ? `${jiraHost}/jira/marketplace/discover/app/com.github.integration.production` : "";

export const jiraSiteExists = async (jiraHost: string): Promise<boolean> => {
	if (!jiraHost?.length) {
		return false
	}

	// Check that the entered domain is valid by making a request to the status endpoint
	return axios(`${jiraHost}/status`, {
		method: "GET",
		headers: {
			"content-type": "application/json"
		}
	})
		.then(
			() => true,
			() => false
		);
};

// this will need to be updated later to check for database entry
import {Installation} from "models/installation";

export const isGitHubEnterpriseApp = async (jiraHost: string): Promise<boolean> => {
	// call Installation getGitHubAppIdForHost
	const installation = await Installation.getForHost(jiraHost);


	// call GitHubServerApps -> get all info for that id
	return false;

	// baseUrl -> app url e.g. http://github.internal.atlassian.com
}

// this will need to be updated later to check for database entry
import {Installation} from "models/installation";

export const isGitHubEnterpriseApp = (jiraHost: string): string | null => {
	// call Installation getGitHubAppIdForHost
	// const installation = await Installation.getForHost(jiraHost);


	// call GitHubServerApps -> get all info for that id
	return "http://github.internal.atlassian.com";

	// baseUrl -> app url e.g.
	// accept headers -> just need to know if an app url exists (could check for null
}

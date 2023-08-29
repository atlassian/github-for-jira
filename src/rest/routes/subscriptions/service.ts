import { Subscription } from "models/subscription";
import { GitHubServerApp } from "models/github-server-app";

export const getAllSubscriptions = async (jiraHost: string, installationId: number) => {
	const subscriptions = await Subscription.getAllForHost(jiraHost);
	const ghEnterpriseServers: GitHubServerApp[] = await GitHubServerApp.findForInstallationId(installationId) || [];

	// Separating the subscriptions for GH cloud and GHE servers
	const ghCloudSubscriptions = subscriptions.filter(subscription => !subscription.gitHubAppId);

	return {
		ghCloudSubscriptions,
		ghEnterpriseServers
	};
};

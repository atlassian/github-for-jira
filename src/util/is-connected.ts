import { Subscription } from "models/subscription";
import { GitHubServerApp } from "models/github-server-app";
import { Request } from "express";
import { getConnectionsAndInstallations } from "routes/jira/jira-get";


export const isConnected = async (req: Request, jiraHost: string, installationId: number): Promise<boolean> => {
	const subscriptions = await Subscription.getAllForHost(jiraHost) || [];
	const gheServers: GitHubServerApp[] = await GitHubServerApp.findForInstallationId(installationId) || [];

	// Separating the subscriptions for GH cloud and GHE servers
	const ghCloudSubscriptions = subscriptions.filter(subscription => !subscription.gitHubAppId);
	// Connections for GHCloud
	const { installations } = await getConnectionsAndInstallations(ghCloudSubscriptions, req);

	return !!(installations.total || gheServers?.length);
};

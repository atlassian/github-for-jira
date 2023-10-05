import { Subscription } from "models/subscription";
import { Request } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { chain, difference } from "lodash";
import {
	getConnectionsAndInstallations, InstallationResults
} from "utils/github-installations-helper";
import { FailedConnection, SuccessfulConnection } from "rest-interfaces";

type GHEServerWithConnection = {
	server: GitHubServerApp;
	successfulConnections: SuccessfulConnection[];
	failedConnections: FailedConnection[];
	installations: InstallationResults;
};

export const getAllSubscriptions = async (jiraHost: string, installationId: number, req: Request) => {
	const subscriptions = await Subscription.getAllForHost(jiraHost);
	const ghEnterpriseServers: GitHubServerApp[] = await GitHubServerApp.findForInstallationId(installationId) || [];

	// Separating the subscriptions for GH cloud and GHE servers
	const ghCloudSubscriptions = subscriptions.filter(subscription => !subscription.gitHubAppId);
	const gheServerSubscriptions = difference(subscriptions, ghCloudSubscriptions);

	// Connections for GHCloud
	const {
		successfulConnections: successfulCloudConnections,
		failedConnections: failedCloudConnections
	} = await getConnectionsAndInstallations(ghCloudSubscriptions, req);

	// Connections for GH Enterprise
	const gheServersWithConnections = await Promise.all(ghEnterpriseServers.map(async (server: GitHubServerApp) => {
		const subscriptionsForServer = gheServerSubscriptions.filter(subscription => subscription.gitHubAppId === server.id);
		const { installations, successfulConnections, failedConnections } = await getConnectionsAndInstallations(subscriptionsForServer, req, server.id);

		/**
		 * Directly fetching the values using `dataValues`,
		 * Couldn't get the value using `{plan: true}`, it throws a crypto error,
		 */
		return { ...server.dataValues, successfulConnections, failedConnections, installations } as GHEServerWithConnection;
	}));

	// Grouping the list of servers by `gitHubBaseUrl`
	const groupedGheServers = chain(gheServersWithConnections).groupBy("gitHubBaseUrl")
		.map((value, key) => ({
			gitHubBaseUrl: key,
			applications: value
		})).value();

	return {
		ghCloudSubscriptions: { successfulCloudConnections, failedCloudConnections },
		ghEnterpriseServers: groupedGheServers
	};
};

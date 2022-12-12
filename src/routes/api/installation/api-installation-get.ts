import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import format from "date-fns/format";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { createAppClient } from "~/src/util/get-github-client-config";

export const ApiInstallationGet = async (req: Request, res: Response): Promise<void> => {
	const { installationId, gitHubAppId: gitHubAppIdStr } = req.params;

	const gitHubAppId = parseInt(gitHubAppIdStr) || undefined;

	const { client, jiraHost } = res.locals;
	const gitHubAppClient = await createAppClient(req.log, jiraHost, gitHubAppId);

	try {
		const subscriptions = await Subscription.getAllForInstallation(Number(installationId), gitHubAppId);

		if (!subscriptions.length) {
			res.sendStatus(404);
			return;
		}

		const { jiraHost } = subscriptions[0];
		const installations = await Promise.all(
			subscriptions.map(async (subscription) => {
				const id = subscription.gitHubInstallationId;
				try {
					const response = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_INSTALLATION_API) ?
						await gitHubAppClient.getInstallation(id) :
						await client.apps.getInstallation({ installation_id: id });

					response.data.syncStatus = subscription.syncStatus;
					return response.data;
				} catch (err) {
					return { error: err, id, deleted: err.status === 404 };
				}
			})
		);
		const connections = installations
			.filter((response) => !response.error)
			.map((data) => ({
				...data,
				isGlobalInstall: data.repository_selection === "all",
				updated_at: format(data.updated_at, "MMMM D, YYYY h:mm a"),
				syncState: data.syncState
			}));

		const failedConnections = installations.filter((response) => {
			req.log.error({ ...response }, "Failed installation");
			return response.error;
		});
		res.json({
			host: jiraHost,
			installationId,
			connections,
			failedConnections,
			hasConnections: connections.length > 0 || failedConnections.length > 0,
			syncStateUrl: `${req.protocol}://${req.get("host")}/api/${installationId}/${encodeURIComponent(jiraHost)}/syncstate`
		});
	} catch (err) {
		req.log.error({ installationId, err }, "Error getting installation");
		res.status(500).json(err);
	}
};

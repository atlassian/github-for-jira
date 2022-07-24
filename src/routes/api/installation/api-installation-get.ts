import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import format from "date-fns/format";
import { createAppClient } from "~/src/util/get-github-client-config";
import { TypeC } from "~/src/github/client/github-app-client";
import { FailedAppInstallation } from "config/interfaces";

export const ApiInstallationGet = async (req: Request, res: Response): Promise<void> => {
	const { installationId } = req.params;
	const { jiraHost, gitHubAppId } = res.locals;
	const gitHubAppClient = await createAppClient(req.log, jiraHost, gitHubAppId);

	try {
		const subscriptions = await Subscription.getAllForInstallation(Number(installationId));

		if (!subscriptions.length) {
			res.sendStatus(404);
			return;
		}

		const { jiraHost } = subscriptions[0];

		const tasks = subscriptions.map(async (subscription): Promise<TypeC | FailedAppInstallation> => {
			const id = subscription.gitHubInstallationId;
			try {
				const response = await gitHubAppClient.getInstallation(id);

				response.data.syncStatus = subscription.syncStatus;
				return response.data;
			} catch (err) {
				return { error: err, id, deleted: err.status === 404 };
			}
		});

		const installations = await Promise.all(tasks);

		const getValidInstallations = (installations: (TypeC | FailedAppInstallation)[]): (TypeC)[] => {
			return installations
				.filter((response) => {
					return !('error' in response);
				}) as TypeC[];
		};

		const connections = getValidInstallations(installations)
			.map((data) => ({
				...data,
				isGlobalInstall: data.repository_selection === "all",
				updated_at: format(data.updated_at, "MMMM D, YYYY h:mm a"),
				syncState: data.syncStatus
			}));

		const failedConnections = installations.filter((response) => {
			req.log.error({ ...response }, "Failed installation");
			return ('error' in response);
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

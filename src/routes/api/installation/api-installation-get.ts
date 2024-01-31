import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { createAppClient } from "~/src/util/get-github-client-config";
import { AxiosResponse } from "axios";
import { Octokit } from "@octokit/rest";
import { errorStringFromUnknown } from "~/src/util/error-string-from-unknown";

export const ApiInstallationGet = async (req: Request, res: Response): Promise<void> => {
	const { installationId, gitHubAppId: gitHubAppIdStr } = req.params;

	const gitHubAppId = parseInt(gitHubAppIdStr) || undefined;

	const { jiraHost } = res.locals;
	const gitHubAppClient = await createAppClient(req.log, jiraHost, gitHubAppId, { trigger: "api_installation_get" });

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
					const response: AxiosResponse<Octokit.AppsGetInstallationResponse> = await gitHubAppClient.getInstallation(id);

					return {
						...response.data,
						isGlobalInstall: response.data.repository_selection === "all",
						syncState: subscription.syncStatus
					};
				} catch (e: unknown) {
					const err = e as { status?: number };
					return { err, id, deleted: err.status === 404 };
				}
			})
		);
		const connections = installations
			.filter((response) => !response.err);

		const failedConnections = installations
			.filter((response) => response.err)
			.map((response) => {
				req.log.error({ ...response }, "Failed installation");
				return {
					id: response.id,
					error: `${errorStringFromUnknown(response.err)}. More details in logs`,
					deleted: response.deleted
				};
			});
		res.json({
			host: jiraHost,
			installationId,
			connections,
			failedConnections,
			hasConnections: connections.length > 0 || failedConnections.length > 0,
			syncStateUrl: `${req.protocol}://${req.get("host") ?? ""}/api/${installationId}/${encodeURIComponent(jiraHost)}/syncstate`
		});
	} catch (err: unknown) {
		req.log.error({ installationId, err }, "Error getting installation");
		res.status(500).json(err);
	}
};

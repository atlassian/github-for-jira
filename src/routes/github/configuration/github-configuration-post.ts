import { Request, Response } from "express";

import { verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";
import { getJiraClient } from "~/src/jira/client/jira-client";
import Logger from "bunyan";
import { createAppClient } from "~/src/util/get-github-client-config";
import { BooleanFlags, booleanFlag } from "~/src/config/feature-flags";

/**
 * Handle when a user adds a repo to this installation
 */
export const GithubConfigurationPost = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, gitHubAppId, installation } = res.locals;
	const gitHubInstallationId = Number(req.body.installationId);

	if (!githubToken) {
		req.log.warn("GitHub token wasn't found");
		res.sendStatus(401);
		return;
	}

	if (!gitHubInstallationId) {
		req.log.warn("gitHubInstallationId wasn't found");
		res.status(400)
			.json({
				err: "An Installation ID must be provided to link an installation."
			});
		return;
	}

	const result = await verifyAdminPermsAndFinishInstallation(githubToken, installation, gitHubAppId, gitHubInstallationId, req.log);
	if (result.error) {
		res.status(401)
			.json({
				err: result.error
			});
		return;
	}
	if (await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, installation.jiraHost)) {
		await submitSecurityWorkspaceToLink(installation.jiraHost, gitHubInstallationId, gitHubAppId, req.log);
	}

	res.sendStatus(200);
};

const submitSecurityWorkspaceToLink = async (
	jiraHost: string,
	gitHubInstallationId: number,
	gitHubServerAppIdPk: number | undefined,
	logger: Logger
) => {

	try {
		const gitHubAppClient = await createAppClient(logger, jiraHost, gitHubServerAppIdPk, { trigger: "github-configuration-post" });

		logger.info("Fetching info about installation");
		const { data: installation } = await gitHubAppClient.getInstallation(gitHubInstallationId);

		const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, gitHubServerAppIdPk, logger);
		await jiraClient.linkedWorkspace.submit(installation.account.id);
	} catch (err) {
		logger.warn("Failed to submit security workspace to Jira", err);
	}

};
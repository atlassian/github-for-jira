import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { EncryptionClient } from "utils/encryption-client";

const log = getLogger("ReEncryptGitHubServerAppKeys");

const decryptWithJiraHost = async (app: GitHubServerApp, field: string, jiraHost: string): Promise<boolean> => {
	try {
		const secret = await EncryptionClient.decrypt(app[field], { jiraHost });
		return !!secret;
	} catch (e) {
		return false;
	}
};

const decryptWithEmptyContext = async (app: GitHubServerApp, field: string): Promise<string> => {
	return await EncryptionClient.decrypt(app[field], {});
};

export const ReEncryptGitHubServerAppKeysPost = async (req: Request, res: Response): Promise<void> => {

	const overrideExisting = req.query.overrideExisting === "true";

	const allExistingGHESApps: GitHubServerApp[] = await GitHubServerApp.findAll();

	res.status(200);

	let count = 0;

	for (const app of allExistingGHESApps) {

		if (!app.installationId) {
			const errMsg = `Installation id is empty for app id ${app.id}\n`;
			res.write(errMsg);
			log.error(errMsg);
			continue;
		}

		const installation = await Installation.findByPk(app.installationId);
		if (!installation) {
			const errMsg = `Installation not found for app id ${app.id}\n`;
			res.write(errMsg);
			log.error(errMsg);
			continue;
		}

		const jiraHost = installation.jiraHost;

		const alreadyWithJiraHost = await decryptWithJiraHost(app, "webhookSecret", jiraHost);
		const shouldReEncrypt = overrideExisting || !alreadyWithJiraHost;

		if (shouldReEncrypt) {

			const webhookSecret = await decryptWithEmptyContext(app, "webhookSecret");
			const privateKey = await decryptWithEmptyContext(app, "privateKey");
			const gitHubClientSecret = await decryptWithEmptyContext(app, "gitHubClientSecret");

			if (!webhookSecret || !privateKey || !gitHubClientSecret) {
				const errMsg = `Some secrets is empty for app ${app.id}`;
				log.error(errMsg);
				res.write(errMsg);
				continue;
			}

			await GitHubServerApp.updateGitHubAppByUUID({
				appId: app.appId,
				uuid: app.uuid,
				webhookSecret,
				privateKey,
				gitHubClientSecret
			}, jiraHost);

			count++;
			const msg = `Successfully update secrets for app ${app.id}`;
			log.info(msg);
			res.write(msg);
		}
	}

	res.write(`Successfully process ${count} github server apps`);

};


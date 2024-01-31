import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { EncryptionClient } from "utils/encryption-client";
import safeJsonStringify from "safe-json-stringify";

const log = getLogger("ReEncryptGitHubServerAppKeys");

const isAlreadyEncryptedWithJiraHost = async (app: GitHubServerApp, field: string, jiraHost: string): Promise<boolean> => {
	try {
		await EncryptionClient.decrypt(app[field], { jiraHost });
		return true;
	} catch (e: unknown) {
		return false;
	}
};

const decryptWithEmptyContext = async (app: GitHubServerApp, field: string): Promise<string> => {
	return await EncryptionClient.decrypt(app[field], {});
};

export const ReEncryptGitHubServerAppKeysPost = async (req: Request, res: Response): Promise<void> => {

	const targetAppId = Number(req.query.targetAppId) || undefined;

	const targetApps: GitHubServerApp[] = await GitHubServerApp.findAll({
		... !targetAppId ? undefined : {
			where: { id: targetAppId }
		}
	});

	res.status(200);

	let count = 0;

	for (const app of targetApps) {

		try {

			if (!app.installationId) {
				const errMsg = `Installation id is empty for app id ${app.id}\n`;
				log.error(errMsg);
				res.write(errMsg);
				continue;
			}

			const installation = await Installation.findByPk(app.installationId);
			if (!installation) {
				const errMsg = `Installation not found for app id ${app.id}\n`;
				log.error(errMsg);
				res.write(errMsg);
				continue;
			}

			const jiraHost = installation.jiraHost;
			if (!jiraHost) {
				const errMsg = `jiraHost not found for app id ${app.id}\n`;
				log.error(errMsg);
				res.write(errMsg);
				continue;
			}

			const alreadyWithJiraHost = await isAlreadyEncryptedWithJiraHost(app, "gitHubClientSecret", jiraHost);
			if (alreadyWithJiraHost) {
				const msg = `Skipping app ${app.id} as already encrypted with jiraHost\n`;
				log.info(msg);
				res.write(msg);
				continue;
			}

			const originWebhookSecret = await decryptWithEmptyContext(app, "webhookSecret");
			const originPrivateKey = await decryptWithEmptyContext(app, "privateKey");
			const originGitHubClientSecret = await decryptWithEmptyContext(app, "gitHubClientSecret");

			if (!originPrivateKey || !originGitHubClientSecret) {
				const errMsg = `Some secrets is empty for app ${app.id}\n`;
				log.error(errMsg);
				res.write(errMsg);
				continue;
			}

			await GitHubServerApp.updateGitHubAppByUUID({
				appId: app.appId,
				uuid: app.uuid,
				webhookSecret: originWebhookSecret,
				privateKey: originPrivateKey,
				gitHubClientSecret: originGitHubClientSecret
			}, jiraHost);

			const updatedApp: GitHubServerApp | null = (await GitHubServerApp.findByPk(app.id));
			if (
				originWebhookSecret !== await updatedApp?.getDecryptedWebhookSecret(jiraHost)
				|| originPrivateKey !== await updatedApp?.getDecryptedPrivateKey(jiraHost)
				|| originGitHubClientSecret !== await updatedApp?.getDecryptedGitHubClientSecret(jiraHost)
			) {
				const msg = `
						== !! ERROR !! === \n
						secrets after update not match origin value for app ${app.id}\n
						This is SERIOUS, need to abort now.
				`;
				res.write(msg);
				res.end();
				return;
			}

			const msg = `Successfully update secrets for app ${app.id}\n`;
			log.info(msg);
			res.write(msg);

			count++;

		} catch (wrapE) {
			const msg = `Skipping app ${app.id}, found error ${safeJsonStringify(wrapE)}\n`;
			log.error(msg);
			res.write(msg);
		}
	}

	res.write(`Successfully process ${count} github server apps\n`);
	res.end();

};


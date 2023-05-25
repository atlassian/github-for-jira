import Logger from "bunyan";
import { Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { stringFlag, StringFlags } from "config/feature-flags";

const maybeMigrateApp = async (parentLogger: Logger, app: GitHubServerApp) => {
	const log = parentLogger.child({
		appUuid: app.uuid
	});
	log.info("Migrating app");
	const installation = await Installation.findByPk(app.installationId);
	if (!installation) {
		log.warn("Installation not found!");
		return;
	}
	const jiraHost = installation.jiraHost;
	const maybeApiKey = await stringFlag(StringFlags.GHE_API_KEY, "", jiraHost);
	if (!maybeApiKey) {
		log.info("No API key found, skipping");
		return;
	}

	if (app.apiKeyHeaderName) {
		log.warn("CONFLICT! The GitHubServerApp already contains the API key, skipping");
		return;
	}

	const [headerName, headerEncryptedValue] = JSON.parse(maybeApiKey) as Array<string>;
	if (!headerName || !headerEncryptedValue) {
		log.warn("Invalid API key, skipping");
		return;
	}

	app.apiKeyHeaderName = headerName;
	app.encryptedApiKeyValue = headerEncryptedValue;
	await app.save();

	log.info("Migrated :clapclap: !");
};

export const ApiBtfMigratePost = async (req: Request, res: Response): Promise<void> => {
	const log = req.log.child({
		btfMigration: true
	});

	const apps = await GitHubServerApp.findAll();
	for (let appIdx = 0; appIdx < apps.length; appIdx++) {
		await maybeMigrateApp(log, apps[appIdx]);
	}

	res.json({
		ok: true
	});
};

import { Request, Response } from "express";
import { envVars } from "~/src/config/env";
import { GheConnectConfigTempStorage, resolveIntoConnectConfig } from "utils/ghe-connect-config-temp-storage";
import { GitHubServerApp } from "models/github-server-app";

export const GithubManifestGet = async (req: Request, res: Response) => {
	const appHost = envVars.APP_URL;
	const connectConfigUuid = req.params.uuid;

	const connectConfig = await resolveIntoConnectConfig(connectConfigUuid, res.locals.installation.id);
	if (!connectConfig) {
		req.log.warn({ connectConfigUuid }, "Cannot find connect config");
		res.sendStatus(404);
		return;
	}

	// We don't want to reuse existing UUIDs
	const uuid = await GitHubServerApp.findForUuid(connectConfigUuid)
		? await new GheConnectConfigTempStorage().store(connectConfig, res.locals.installation.id)
		: connectConfigUuid;

	res.render("github-manifest.hbs", {
		nonce: res.locals.nonce,
		appHost,
		uuid,
		gheHost: connectConfig.serverUrl,
		title: "Creating manifest and redirecting to your GitHub Enterprise Server instance"
	});
};

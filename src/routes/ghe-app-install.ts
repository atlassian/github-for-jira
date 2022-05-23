
import { Request, Response } from "express";
import axios from "axios";
import { GitHubServerApp } from "../models/git-hub-server-app";

export const GheAppInstall = async (req: Request, res: Response) => {

	try {
		//const apiUrl = `https://api.github.com/app-manifests/${req.query.code}/conversions`;
		const apiUrl = `http://github.internal.atlassian.com/api/v3/app-manifests/${req.query.code}/conversions`;
		const gitHubApp = await axios.post(apiUrl, {}, { headers: { Accept: "application/vnd.github.v3+json" } });
		const gitHubAppConfig = gitHubApp.data;
		const gitHubServerApp = await GitHubServerApp.create({
			githubBaseUrl: "https://wwww.github.com/",
			githubClientId: gitHubAppConfig.client_id,
			githubClientSecret: gitHubAppConfig.client_secret,
			webhookSecret: gitHubAppConfig.webhook_secret,
			privateKey: gitHubAppConfig.pem

		});
		res.json({
			"success": true,
			"uuid": gitHubServerApp.uuid,
			"data": gitHubApp.data
		})
	} catch (err) {
		console.log(err);

	}

};
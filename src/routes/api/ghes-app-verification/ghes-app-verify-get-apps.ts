import { Request, Response } from "express";
import { createAppClient } from "~/src/util/get-github-client-config";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { runCurl } from "utils/curl/curl-utils";
import { AppTokenHolder } from "~/src/github/client/app-token-holder";

export const GHESVerifyGetApps = async (req: Request, res: Response): Promise<void> => {

	const gitHubAppId = parseInt(req.params["gitHubAppId"] || "");
	if (isNaN(gitHubAppId)) {
		res.status(400).json({ message: "Invalid gitHubAppId" });
		return;
	}

	const app = await GitHubServerApp.findByPk(gitHubAppId);
	if (!app) {
		res.status(400).json({ message: "Cannot find app" });
		return;
	}

	const installation = await Installation.findByPk(app.installationId);
	if (!installation) {
		res.status(400).json({ message: "Cannot find installation" });
		return;
	}

	const gitHubAppClient = await createAppClient(req.log, installation.jiraHost, gitHubAppId, { trigger: "api verify ghes apps" });

	try {
		const { data } = await gitHubAppClient.getApp();
		res.status(200).json(data);
		return;
	} catch (e) {
		try {
			const output = await runCurl({
				fullUrl: `${gitHubAppClient.restApiUrl}/app`,
				method: "GET",
				authorization: `Bearer ${AppTokenHolder.createAppJwt(await app.getDecryptedPrivateKey(installation.jiraHost), String(app.appId)).token}`
			});
			res.status(500).json(output);
			return;
		} catch (e2) {
			res.status(500).json({ message: "Error fetching curl", error: e2 });
			return;
		}

	}

};


import { Request, Response } from "express";
import {
	createAppClient
} from "~/src/util/get-github-client-config";

export const GithubConfigurationAppInstallsGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info("GithubAppInstallationGet");

	const {
		jiraHost,
		githubToken,
		gitHubAppConfig
	} = res.locals;

	const log = req.log.child({ jiraHost });

	if (!githubToken || !gitHubAppConfig) {
		res.sendStatus(401);
		return;
	}

	const { gitHubAppId } = gitHubAppConfig;
	const gitHubAppClient = await createAppClient(log, jiraHost, gitHubAppId, { trigger: "github-configuration-get" });
	const { data } = await gitHubAppClient.getApp();
	res.redirect(`${data.html_url}/installations/new`);

};

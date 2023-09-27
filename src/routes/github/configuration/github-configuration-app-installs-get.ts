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

	let newInstallationUrl;
	// We need to re-generate the URL for server because API gateway might override the hostname
	if (data.html_url.indexOf("/github-apps/") > 0) {
		// https://docs.github.com/en/enterprise-server@3.8/apps/maintaining-github-apps/installing-github-apps
		newInstallationUrl = `${gitHubAppConfig.hostname as string}/github-apps/${data.html_url.split("/github-apps/")[1]}/installations/new`;
	} else {
		newInstallationUrl = `${data.html_url}/installations/new`;
	}
	res.redirect(newInstallationUrl);

};

import { Router, Request, Response } from "express";
import { errorWrapper } from "../../helper";
import { createAppClient } from "~/src/util/get-github-client-config";
import { GetGitHubAppsUrlResponse } from "rest-interfaces";
import { BaseLocals } from "..";

export const GitHubAppsRoute = Router({ mergeParams: true });

GitHubAppsRoute.get("/new", errorWrapper("GetGitHubAppsUrl", async function GetGitHubAppsUrl(req: Request, res: Response<GetGitHubAppsUrlResponse, BaseLocals>) {
	const { jiraHost } = res.locals;
	const log = req.log.child({ jiraHost });
	const gitHubAppClient = await createAppClient(log, jiraHost, undefined, { trigger: "github-apps-url-get" });
	const { data } = await gitHubAppClient.getApp();
	const appInstallationUrl = `${data.html_url}/installations/new?state=spa`;
	res.status(200).json({
		appInstallationUrl
	});
}));

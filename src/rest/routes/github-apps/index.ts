import { Router, Request, Response, NextFunction } from "express";
import { createAppClient } from "~/src/util/get-github-client-config";
import { GetGitHubAppsUrlResponse } from "rest-interfaces/oauth-types";

export const GitHubAppsRoute = Router({ mergeParams: true });

GitHubAppsRoute.get("/new", async function GetGitHubAppsUrl(req: Request, res: Response<GetGitHubAppsUrlResponse>, next: NextFunction) {
	const { jiraHost } = res.locals;
	const log = req.log.child({ jiraHost });
	try {
		const gitHubAppClient = await createAppClient(log, jiraHost, undefined, { trigger: "github-apps-url-get" });
		const { data } = await gitHubAppClient.getApp();
		const appInstallationUrl = `${data.html_url}/installations/new`;
		res.status(200).json({
			appInstallationUrl
		});
	} catch (e) {
		req.log.error({ err: e }, "Failed to get the new installation URL");
		next(e);
	}
});

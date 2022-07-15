import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";

export const GithubServerAppMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {


	const { jiraHost } = res.locals;
	const { appId: idStr } = req.params;
	const id = parseInt(idStr as string);
	console.log('--- new route, app server middleware ---', {
		jiraHost: res.locals.jiraHost,
		appId: req.params.appId,
		id,
		baseUrl: req.baseUrl,
		path: req.path,
	});

	if (idStr && isNaN(id)) {
		//throw new Error("Provided id found but not a number " + id);
		next();
		return;
	}

	console.log('--- gsam 1', {id, idStr});

	if (id) {
		req.log.debug(`Retrieving GitHub app with id ${id}`);
		const gitHubServerApp = await GitHubServerApp.getForGitHubServerAppId(id);

		if (!gitHubServerApp) {
			req.log.error({ id, jiraHost }, "No GitHub app found for provided id.");
			throw new Error("No GitHub app found for provided id.");
		}

		const installation = await Installation.findByPk(gitHubServerApp.installationId);

		if (installation?.jiraHost !== jiraHost) {
			req.log.error({ id, jiraHost }, "Jira hosts do not match");
			throw new Error("Jira hosts do not match.");
		}

		req.log.info("Found GitHub server app for installation");
		res.locals.gitHubAppId = id;
		return next();
	}

	console.log('--- gsam 2');
	next();
};


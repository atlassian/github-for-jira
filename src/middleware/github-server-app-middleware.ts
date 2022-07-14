import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";

export const GithubServerAppMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { jiraHost } = res.locals;
	const { gitHubServerAppUUID } = req.params;

	if (gitHubServerAppUUID) {
		req.log.debug(`Retrieving GitHub app with id ${gitHubServerAppUUID}`);
		const gitHubServerApp = await GitHubServerApp.getForGitHubServerAppId(Number(gitHubServerAppUUID));

		if (!gitHubServerApp) {
			req.log.error({ gitHubServerAppUUID, jiraHost }, "No GitHub app found for provided id.");
			throw new Error("No GitHub app found for provided id.");
		}

		const installation = await Installation.findByPk(gitHubServerApp.installationId);

		if (installation?.jiraHost !== jiraHost) {
			req.log.error({ gitHubServerAppUUID, jiraHost }, "Jira hosts do not match");
			throw new Error("Jira hosts do not match.");
		}

		req.log.info("Found GitHub server app for installation");
		res.locals.gitHubAppId = gitHubServerAppUUID;
		return next();
	}

	next();
};

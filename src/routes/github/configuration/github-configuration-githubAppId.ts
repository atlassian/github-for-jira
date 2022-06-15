import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";

export const GithubConfigurationGitHubAppId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { jiraHost } = res.locals;
	const { id } = req.params;

	if (!id) {
		req.log.info("No GitHubAppId detected. Continuing to github configuration GET.");
		next();
	}

	const gitHubServerApp = await GitHubServerApp.getForGitHubServerAppId(Number(id));

	if (!gitHubServerApp) {
		req.log.error({ id, jiraHost }, "No GitHub app found for provided id.");
		throw new Error("No GitHub app found for provided id.");
	}

	const installation = await Installation.getForHost(jiraHost);

	if (installation?.id !== gitHubServerApp.installationId) {
		req.log.error({ id, jiraHost }, "Installation ids do not match.");
		throw new Error("Installation ids do not match.");
	}

	next();
};

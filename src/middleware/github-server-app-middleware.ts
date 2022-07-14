import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";

export type GitHubAppReqLocals<T = Record<string, any>> = T & {
	gitHubAppConfig: {
		gitHubAppId: number | undefined;
		uuid: string;
	}
}

export const GithubServerAppMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { jiraHost } = res.locals;
	const { githubAppId: id } = req.params;

	if (id) {
		req.log.debug(`Retrieving GitHub app with id ${id}`);
		//TODO: ARC-1515 confirm the unique id and possibly change it to uuid
		const gitHubServerApp = await GitHubServerApp.getForGitHubServerAppId(Number(id));

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
		(res.locals as GitHubAppReqLocals).gitHubAppConfig = {
			gitHubAppId: parseInt(id),
			uuid: gitHubServerApp.uuid
		};
		return next();
	}

	next();
};


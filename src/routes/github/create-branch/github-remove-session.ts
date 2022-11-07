import { Request, Response } from "express";

type ResponseType = Response<
	{ baseUrl: string },
	JiraHostVerifiedLocals
	& GitHubUserTokenVerifiedLocals
	& GitHubAppVerifiedLocals
>;

export const GithubRemoveSession = (req: Request, res: ResponseType) => {
	const { gitHubAppConfig } = res.locals;

	if (!gitHubAppConfig) {
		res.sendStatus(401);
		return;
	}

	req.session.githubToken = undefined;
	res.send({ baseUrl: gitHubAppConfig.gitHubBaseUrl });

};

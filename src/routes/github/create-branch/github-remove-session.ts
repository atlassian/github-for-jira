import { Request, Response } from "express";


export const GithubRemoveSession = (req: Request, res: Response) => {
	const { gitHubAppConfig } = res.locals;

	if (!gitHubAppConfig) {
		res.sendStatus(401);
		return;
	}

	req.session.githubToken = undefined;
	req.session.githubRefreshToken = undefined;
	res.send({ baseUrl: gitHubAppConfig.hostname });

};
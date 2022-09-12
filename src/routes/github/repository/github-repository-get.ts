import { Request, Response } from "express";

export const GitHubRepositoryGet = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost } = res.locals;

	if (!githubToken || !jiraHost) {
		res.sendStatus(401);
		return;
	}

	try {
		res.send({
			respositories: []
		});
	} catch (err) {
		req.log.error({ err }, "Error creating branch");
		res.sendStatus(500);
	}
};

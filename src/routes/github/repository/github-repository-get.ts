import { Request, Response } from "express";

export const GitHubRepositoryGet = async (req: Request, res: Response): Promise<void> => {
	const { githubToken } = res.locals;

	if (!githubToken) {
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

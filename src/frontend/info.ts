import { Request, Response } from "express";

export default (_: Request, res: Response) => {
	res.send({
		commit: `https://github.com/atlassian/github-for-jira/commit/${process.env.COMMIT_SHA}`,
		date: process.env.COMMIT_DATE
	});
};

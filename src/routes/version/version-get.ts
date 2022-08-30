import { Request, Response } from "express";

export const VersionGet = (_: Request, res: Response) => {
	res.send({
		branch: process.env.GIT_BRANCH_NAME,
		branchUrl: `${process.env.GITHUB_REPO_URL}/tree/${process.env.GIT_BRANCH_NAME}`,
		commit: process.env.GIT_COMMIT_SHA,
		commitDate: process.env.GIT_COMMIT_DATE,
		commitUrl: `${process.env.GITHUB_REPO_URL}/commit/${process.env.GIT_COMMIT_SHA}`,
		deploymentDate: process.env.DEPLOYMENT_DATE
	});
};

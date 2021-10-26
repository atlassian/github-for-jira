import { Request, Response } from "express";
import envVars from "../config/env";

export default (_: Request, res: Response) => {
	res.send({
		branch: process.env.GIT_BRANCH_NAME,
		branchUrl: `${envVars.GITHUB_REPO_URL}/tree/${process.env.GIT_BRANCH_NAME}`,
		commit: process.env.GIT_COMMIT_SHA,
		commitDate: process.env.GIT_COMMIT_DATE,
		commitUrl: `${envVars.GITHUB_REPO_URL}/commit/${process.env.GIT_COMMIT_SHA}`
	});
};

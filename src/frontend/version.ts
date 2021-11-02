import { Request, Response } from "express";
import envVars from "../config/env";

export default (_: Request, res: Response) => {
	res.send({
		branch: envVars.GIT_BRANCH_NAME,
		branchUrl: `${envVars.GITHUB_REPO_URL}/tree/${envVars.GIT_BRANCH_NAME}`,
		commit: envVars.GIT_COMMIT_SHA,
		commitDate: envVars.GIT_COMMIT_DATE,
		commitUrl: `${envVars.GITHUB_REPO_URL}/commit/${envVars.GIT_COMMIT_SHA}`,
		deploymentDate: envVars.DEPLOYMENT_DATE
	});
};

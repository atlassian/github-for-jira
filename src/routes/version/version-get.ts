import { Request, Response } from "express";
import { envVars }  from "config/env";

export const VersionGet = (_: Request, res: Response) => {
	res.send({
		branch: envVars.GIT_BRANCH_NAME,
		branchUrl: `${envVars.GITHUB_REPO_URL}/tree/${envVars.GIT_BRANCH_NAME ?? "undefined"}`,
		commit: envVars.GIT_COMMIT_SHA,
		commitDate: envVars.GIT_COMMIT_DATE,
		commitUrl: `${envVars.GITHUB_REPO_URL}/commit/${envVars.GIT_COMMIT_SHA ?? "undefined"}`,
		deploymentDate: envVars.DEPLOYMENT_DATE
	});
};

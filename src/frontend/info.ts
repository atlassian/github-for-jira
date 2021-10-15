import { Request, Response } from "express";

export default (_: Request, res: Response) => {
	res.send({
		branch: process.env.GIT_BRANCH_NAME,
		branchUr: `https://github.com/atlassian/github-for-jira/tree/${process.env.GIT_BRANCH_NAME}`,
		commit: process.env.GIT_COMMIT_SHA,
		commitDate: process.env.GIT_COMMIT_DATE,
		commitUrl: `https://github.com/atlassian/github-for-jira/commit/${process.env.GIT_COMMIT_SHA}`
	});
};

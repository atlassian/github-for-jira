import { NextFunction, Request, Response } from "express";


// add id
// no id = cloud
// add middleware - check that app exists and that it correlates with the jiraHost
export const GithubConfigurationGitHubAppId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	req.log.info("HERE", req.params)

};

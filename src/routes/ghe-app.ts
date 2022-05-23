
import { Request, Response } from "express";
import { GitHubServerApp } from "../models/git-hub-server-app";

export const GheApp = async (req: Request, res: Response) => {
	const uuid = req.params.uuid;
	const githubServerApp = await GitHubServerApp.findOne({ where: { uuid: uuid } });
	res.json(githubServerApp)

};
import { Request, Response } from "express";
import { ConfiguratorTempStorage } from "~/src/util/configurator-temp-storage";


export const SaveSatePost = async (req: Request, res: Response): Promise<void> => {
	const installationId = 1234;
	const jiraHost = "harminder.atlassian.net";
	const state = req.body.state;
	await ConfiguratorTempStorage.store(state, installationId, jiraHost);
	res.send(true);
};

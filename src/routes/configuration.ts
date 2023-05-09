import { Request, Response } from "express";
import { ConfiguratorTempStorage } from "~/src/util/configurator-temp-storage";


export const ConfigurationGet = async (_req: Request, res: Response): Promise<void> => {
	const installationId = 1234;
	const jiraHost = "harminder.atlassian.net";
	let state = await ConfiguratorTempStorage.get(jiraHost, installationId);
	if (!state) {
		state = { };
	}
	res.render("configuration.hbs", {
		state: JSON.stringify(state)
	});

};

import { Request, Response } from "express";
import { WhereOptions } from "sequelize";
import { Installation } from "models/installation";
import { serializeJiraInstallation } from "../api-utils";

export const ApiJiraGet = async (req: Request, res: Response): Promise<void> => {
	const where: WhereOptions = req.params.clientKeyOrJiraHost.startsWith("http")
		? { jiraHost: req.params.clientKeyOrJiraHost }
		: { clientKey: req.params.clientKeyOrJiraHost };
	const jiraInstallations = await Installation.findAll({ where });
	if (!jiraInstallations.length) {
		res.sendStatus(404);
		return;
	}
	res.json(jiraInstallations.map((jiraInstallation) =>
		serializeJiraInstallation(jiraInstallation, req.log)
	));
};

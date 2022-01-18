import express, { Request, Response } from "express";
import { check, oneOf } from "express-validator";
import BodyParser from "body-parser";
import { Installation } from "../../../models";
import verifyInstallation from "../../../jira/verify-installation";
import JiraClient from "../../../models/jira-client";
import uninstall from "../../../jira/uninstall";
import { serializeJiraInstallation, returnOnValidationError  } from "../api-utils";
import { WhereOptions } from "sequelize";

export const ApiJiraRouter = express.Router();
const bodyParser = BodyParser.urlencoded({ extended: false });

ApiJiraRouter.get(
	"/:clientKeyOrJiraHost",
	[
		bodyParser,
		oneOf([
			check("clientKeyOrJiraHost").isURL(),
			check("clientKeyOrJiraHost").isHexadecimal()
		]),
		returnOnValidationError
	],
	async (req: Request, res: Response): Promise<void> => {
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
	}
);

ApiJiraRouter.post(
	"/:clientKey/uninstall",
	bodyParser,
	check("clientKey").isHexadecimal(),
	returnOnValidationError,
	async (request: Request, response: Response): Promise<void> => {
		response.locals.installation = await Installation.findOne({
			where: { clientKey: request.params.clientKey }
		});

		if (!response.locals.installation) {
			response.sendStatus(404);
			return;
		}
		const jiraClient = new JiraClient(
			response.locals.installation,
			request.log
		);
		const checkAuthorization = request.body.force !== "true";

		if (checkAuthorization && (await jiraClient.isAuthorized())) {
			response
				.status(400)
				.json({
					message: "Refusing to uninstall authorized Jira installation"
				});
			return;
		}
		request.log.info(
			`Forcing uninstall for ${response.locals.installation.clientKey}`
		);
		await uninstall(request, response);
	}
);

ApiJiraRouter.post(
	"/:installationId/verify",
	bodyParser,
	check("installationId").isInt(),
	returnOnValidationError,
	async (req: Request, res: Response): Promise<void> => {
		const { installationId } = req.params;
		const installation = await Installation.findByPk(installationId);
		const isValid = await verifyInstallation(installation, req.log)();
		res.json({
			message: isValid ? "Verification successful" : "Verification failed",
			installation: {
				enabled: isValid,
				id: installation.id,
				jiraHost: installation.jiraHost
			}
		});
	}
);

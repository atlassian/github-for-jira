import { Request, Response, Router } from "express";
import { oneOf, param } from "express-validator";
import { Installation } from "../../../models";
import verifyInstallation from "../../../jira/verify-installation";
import JiraClient from "../../../models/jira-client";
import uninstall from "../../../jira/uninstall";
import { returnOnValidationError, serializeJiraInstallation } from "../api-utils";
import { WhereOptions } from "sequelize";

export const ApiJiraRouter = Router();

ApiJiraRouter.get(
	"/:clientKeyOrJiraHost",
	[
		oneOf([
			param("clientKeyOrJiraHost").isURL(),
			param("clientKeyOrJiraHost").isHexadecimal()
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
	});

ApiJiraRouter.post(
	"/:clientKey/uninstall",
	param("clientKey").isHexadecimal(),
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
	param("installationId").isInt(),
	returnOnValidationError,
	async (req: Request, res: Response): Promise<void> => {
		const { installationId } = req.params;
		try {
			const installation = await Installation.findByPk(Number(installationId));
			if (!installation) {
				req.log.error({ installationId }, "Installation doesn't exist");
				res.status(500).send("Installation doesn't exist");
				return;
			}
			const isValid = await verifyInstallation(installation, req.log)();
			res.json({
				message: isValid ? "Verification successful" : "Verification failed",
				installation: {
					enabled: isValid,
					id: installation.id,
					jiraHost: installation.jiraHost
				}
			});
		} catch (err) {
			req.log.error({ installationId, err }, "Error getting installation");
			res.status(500).json(err);
		}
	});

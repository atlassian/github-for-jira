import { Request, Response } from "express";
import { Installation } from "models/installation";
import { verifyJiraInstallation } from "~/src/jira/verify-installation";

export const ApiJiraVerifyPost = async (req: Request, res: Response): Promise<void> => {
	const { installationId } = req.params;
	try {
		const installation = await Installation.findByPk(Number(installationId));
		if (!installation) {
			req.log.error({ installationId }, "Installation doesn't exist");
			res.status(500).send("Installation doesn't exist");
			return;
		}
		const isValid = await verifyJiraInstallation(installation, req.log)();
		res.json({
			message: isValid ? "Verification successful" : "Verification failed",
			installation: {
				enabled: isValid,
				id: installation.id,
				jiraHost: installation.jiraHost
			}
		});
	} catch (err: unknown) {
		req.log.error({ installationId, err }, "Error getting installation");
		res.status(500).json(err);
	}
};

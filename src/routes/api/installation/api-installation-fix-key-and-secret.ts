import { Request, Response } from "express";
import {Installation} from "models/installation";

/**
 * This is useful when a user has 2 installations (by whatever crazy reason this is possible) and one of them
 * is broken (JWT token something 401 errors in splunk)
 *
 */
export const ApiInstallationFixKeyAndSecret = async (req: Request, res: Response): Promise<void> => {
	const installationId = Number(req.params.installationId);
	const fromInstallationId = Number(req.params.fromInstallationId);

	function handleMissingParam(paramName: string) {
		const msg = `Missing param ${paramName}`;
		req.log.warn({ req, res }, msg);
		res.status(400).send(msg);
	}

	if (!installationId) {
		return handleMissingParam("installationId");
	}

	if (!fromInstallationId) {
		return handleMissingParam("fromInstallationId");
	}

	async function withInstallation(installationId: number, callback: (installation: Installation) => void) {
		const installation = await Installation.findByPk(installationId);

		if (!installation) {
			const msg = `Cannot find installation with id ${installationId}`;
			req.log.warn({req, res}, msg);
			res.status(400).send(msg);
			return;
		}
		callback(installation);
	}

	await withInstallation(installationId, async (installation) => {
		await withInstallation(fromInstallationId, async (fromInstallation) => {
			installation.setAttributes({
				clientKey: fromInstallation.clientKey,
				secrets: fromInstallation.secrets
			});
			await installation.save();
			res.status(200).send(`fixed client key and secret of installation ${installationId} using installation ${fromInstallationId}`);
			return;
		});
	});
};

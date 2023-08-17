import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { EncryptionClient } from "utils/encryption-client";

const logger = getLogger("healthcheck");
export const HealthcheckGetPost = async (req: Request, res: Response): Promise<void> => {

	try {
		if (req.params["uuid"]) {
			logger.info({ uuid: req.params["uuid"] }, "healthcheck call from GHEs");
		}
		await EncryptionClient.healthcheck();
		await EncryptionClient.deepcheck();
	} catch (err) {
		logger.debug(err, "Cryptor deepcheck failed.");
		res.status(500).send("NOT OK");
		return;
	}

	logger.debug("Successfully called /healthcheck.");
	res.status(200).send("OK");
};


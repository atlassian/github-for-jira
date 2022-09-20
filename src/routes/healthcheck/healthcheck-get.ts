import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { deepCheckCryptor } from "./deep-check-cryptor";

const logger = getLogger("healthcheck");
export const HealthcheckGet = async (_: Request, res: Response): Promise<void> => {

	try {
		await deepCheckCryptor();
	} catch (e) {
		logger.warn("Cryptor deepcheck failed in work. This happen during startup when Worker started by Cryptor sidecar is not ready.", { error: e });
		res.status(500).send("NOT OK");
		return;
	}

	logger.debug("Successfully called /healthcheck.");
	res.status(200).send("OK");
};


import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { deepCheckCryptor } from "./deep-check-cryptor";

const logger = getLogger("healthcheck");
export const HealthcheckGet = async (_: Request, res: Response): Promise<void> => {

	if (envVars.MICROS_GROUP === "Worker") {
		try {
			await deepCheckCryptor();
		} catch (e) {
			logger.warn("Cryptor not ready yet", { error: e });
			res.status(500).send("NOT OK");
			return;
		}
	}

	logger.debug("Successfully called /healthcheck.");
	res.status(200).send("OK");
};


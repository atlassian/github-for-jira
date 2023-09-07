import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { EncryptionClient } from "utils/encryption-client";

enum CryptorState {
	UNKNOWN,
	READY,
	READY_FULL_STOP // one extra state just for the sake of logging
}
let cryptorState = CryptorState.UNKNOWN;

const logger = getLogger("healthcheck");
export const HealthcheckGetPost = async (req: Request, res: Response): Promise<void> => {

	try {
		if (req.params["uuid"]) {
			logger.info({ uuid: req.params["uuid"] }, "healthcheck call from GHEs");
		}
		if (req.query["reset_cryptor_check_state"]) {
			cryptorState = CryptorState.UNKNOWN;
		}

		if (cryptorState === CryptorState.UNKNOWN) {
			logger.info("Checking cryptor");
			await EncryptionClient.healthcheck();
			await EncryptionClient.deepcheck();
			logger.info("Cryptor is ready");
			cryptorState = CryptorState.READY;

		} else if (cryptorState === CryptorState.READY) {
			logger.info("Cryptor is already ready, no further checks");
			cryptorState = CryptorState.READY_FULL_STOP;
		}
	} catch (err) {
		logger.warn(err, "Cryptor deepcheck failed.");
		res.status(500).send("NOT OK");
		return;
	}

	logger.debug("Successfully called /healthcheck.");
	res.status(200).send("OK");
};


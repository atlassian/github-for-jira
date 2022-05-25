import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { createHashWithSharedSecret } from "~/src/util/encryption";

const logger = getLogger("healthcheck");
export const HealthcheckGet = (_: Request, res: Response): void => {
	logger.debug("Successfully called /healthcheck.");
	// TEMPORARY DISPLAY OF HASH SO I CAN VERiFIY ON STAGE / MICROS STASH
	const hash = createHashWithSharedSecret('testdata');
	res.status(200).send("OK " + hash);
};

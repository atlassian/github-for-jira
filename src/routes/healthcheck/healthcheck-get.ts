import { Request, Response } from "express";
import { getLogger } from "config/logger";

const logger = getLogger("healthcheck");
export const HealthcheckGet = (_: Request, res: Response): void => {
	logger.debug("Successfully called /healthcheck.");
	res.status(200).send("OK");
};

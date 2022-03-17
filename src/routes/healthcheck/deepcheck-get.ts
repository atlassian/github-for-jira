import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { sequelize } from "models/sequelize";
import IORedis from "ioredis";
import getRedisInfo from "config/redis-info";

const cache = new IORedis(getRedisInfo("ping"));
const logger = getLogger("deepcheck");
export const DeepcheckGet = async (_: Request, res: Response): Promise<void> => {
	const timeout = 5000;

	const redisPromise = cache.ping()
		.catch(() => Promise.reject("Could not connect to Redis"));
	const databasePromise = sequelize.authenticate()
		.catch(() => Promise.reject("Could not connect to postgres DB"));
	const timeoutPromise = new Promise((_, reject) =>
		setTimeout(() => reject(`deepcheck timed out after ${timeout}ms`), timeout)
	);

	try {
		await Promise.race([
			Promise.all([redisPromise, databasePromise]),
			timeoutPromise
		]);
	} catch (error) {
		logger.error({ reason: error }, "Error during /deepcheck");
		res.status(500).send("NOT OK");
	}

	logger.debug("Successfully called /deepcheck");
	res.status(200).send("OK");
};

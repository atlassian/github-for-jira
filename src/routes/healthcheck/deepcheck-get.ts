import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { sequelize } from "models/sequelize";
import IORedis from "ioredis";
import { getRedisInfo } from "config/redis-info";
import { EncryptionClient } from "utils/encryption-client";

const logger = getLogger("deepcheck");
const timeout = 15000;
export const DeepcheckGet = async (_: Request, res: Response): Promise<void> => {
	const cache = new IORedis(getRedisInfo("ping"));
	try {
		await Promise.race([
			Promise.all([
				cache.ping().then(() => logger.info("redis works"), () => Promise.reject("Could not connect to Redis")),
				sequelize.authenticate().then(() => logger.info("DB works"), () => Promise.reject("Could not connect to postgres DB")),
				EncryptionClient.deepcheck().then(() => logger.info("Cryptor works"), () => Promise.reject("Could not connect to Cryptor"))
			]),
			new Promise((_, reject) => setTimeout(() => reject(`deepcheck timed out after ${timeout}ms`), timeout))
		]);

		logger.debug("Successfully called /deepcheck");
		res.status(200).send("OK");
	} catch (error: unknown) {
		logger.error({ reason: error }, "Error during /deepcheck");
		res.status(500).send("NOT OK");
	}
};

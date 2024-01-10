import { getNodeEnv } from "utils/is-node-env";
import { Options, Sequelize } from "sequelize";
import dbConfig from "db/config.json";
import EncryptedField from "sequelize-encrypted";
import crypto from "crypto";
import { getLogger } from "config/logger";

interface ExtendedConfig extends Options {
	disable_sql_logging?: boolean;
	use_env_variable?: string;
}

const logger = getLogger("sequelize");
// TODO: config misses timezone config to force to UTC, defaults to local timezone of PST
const config = dbConfig[getNodeEnv()] as ExtendedConfig;

config.benchmark = true;
config.logging = config.disable_sql_logging
	? undefined
	: (query, ms) => { logger.trace({ ms }, query); };

// TODO: need to move this into a function
if (!process.env.STORAGE_SECRET) {
	throw new Error("STORAGE_SECRET is not defined.");
}

export const getHashedKey = (clientKey: string): string => {
	const keyHash = crypto.createHmac("sha256", process.env.STORAGE_SECRET || "");
	keyHash.update(clientKey);
	return keyHash.digest("hex");
};

export const encrypted = EncryptedField(Sequelize, process.env.STORAGE_SECRET);

export const sequelize = config.use_env_variable
	? new Sequelize(process.env[config.use_env_variable] || "DATABASE_URL", config)
	: new Sequelize(config);

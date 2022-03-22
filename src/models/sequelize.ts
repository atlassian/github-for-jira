import logger from "config/logger";
import { getNodeEnv } from "utils/isNodeEnv";
import { Sequelize } from "sequelize";
import dbConfig from "db/config.json";

// TODO: config misses timezone config to force to UTC, defaults to local timezone of PST
const config = dbConfig[getNodeEnv()];

config.benchmark = true;
config.logging = config.disable_sql_logging
	? undefined
	: (query, ms) => logger.trace({ ms }, query);

export const sequelize = config.use_env_variable
	? new Sequelize(process.env[config.use_env_variable] || "DATABASE_URL", config)
	: new Sequelize(config);

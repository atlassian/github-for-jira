import Sequelize from "sequelize";
import logger from "../config/logger";
import { EnvironmentEnum } from "../config/env";
import { getNodeEnv } from "../util/isNodeEnv";

const nodeEnv = getNodeEnv() || EnvironmentEnum.development;
// TODO: config misses timezone config to force to UTC, defaults to local timezone of PST
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("../../db/config.json")[nodeEnv];

config.benchmark = true;
config.logging = config.disable_sql_logging
	? undefined
	: (query, ms) => logger.trace({ ms }, query);

const databaseUrl = process.env[config.use_env_variable];
export const sequelize = databaseUrl
	? new Sequelize.Sequelize(databaseUrl, config)
	: new Sequelize.Sequelize(config);

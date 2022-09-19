import { Request } from "express";
import fs from "fs";
import path from "path";
import { isNodeDev, isNodeTest, isNodeProd, getNodeEnv } from "utils/is-node-env";
import { getLogger } from "config/logger";
import { exec as execOrigin } from "child_process";
import { promisify } from "util";

const exec = promisify(execOrigin);
const logger = getLogger("DBMigration");

export const getTargetScript = (req: Request) => {
	let targetScript = (req.body || {}).targetScript;
	if (!targetScript) {
		throw {
			statusCode: 400,
			message: `"targetScript" is mandatory in the request body, but found none.`
		};
	}
	if (!targetScript.endsWith(".js")) targetScript = targetScript + ".js";
	return targetScript;
};

export const validateScriptLocally = async (targetScript: string) => {

	const scripts = await fs.promises.readdir(path.resolve(process.cwd(), "db/migrations"));
	scripts.sort(); //sort by name, asc, so filename order has to be in order now.
	const latestScriptsInRepo = scripts[scripts.length-1];

	if (targetScript.toLowerCase() !== latestScriptsInRepo.toLowerCase()) {
		throw {
			statusCode: 400,
			message: `"targetScript: ${targetScript}" doesn't match latest scripts in db/migrations ${latestScriptsInRepo}`
		};
	}
};

export enum DBMigrationType {
	UP = "UP",
	DOWN = "DOWN"
}

export const startDBMigration = async (targetScript: string, ops: DBMigrationType) => {
	logger.info(`All validation pass, now executing db migration script ${targetScript} for ${ops}`);
	const env = getDBMigrateEnv();
	const cmd = ops === DBMigrationType.UP ?
		`./node_modules/.bin/sequelize db:migrate --env ${env}`
		: `./node_modules/.bin/sequelize db:migrate:undo:all --to ${targetScript} --env ${env}`;

	const { stdout, stderr } = await exec(cmd);
	const isSuccess = stderr ? false : true;
	if (isSuccess) {
		logger.info({ stdout, stderr }, `DB migration UP SUCCESSS!! -  ${targetScript}`);
	} else {
		logger.error({ stdout, stderr }, `DB migration UP FAILED!! -  ${targetScript}`);
	}
	return {
		isSuccess,
		stdout,
		stderr
	};
};

const getDBMigrateEnv = () => {
	if (isNodeDev()) return "development";
	if (isNodeTest()) return "test";
	if (isNodeProd()) return "production-migrate";
	throw {
		statusCode: 500,
		message: `Cannot determin node env for [${getNodeEnv()}]`
	};
};


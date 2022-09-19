import { Request } from "express";
import fs from "fs";
import path from "path";
import { isNodeDev, isNodeTest, isNodeProd, getNodeEnv } from "utils/is-node-env";
import { getLogger } from "config/logger";
import { exec as execOrigin } from "child_process";
import { promisify } from "util";

const exec = promisify(execOrigin);
const logger = getLogger("DBMigration");

/**
 * Return the common param in req.body `targetScript` to migrate up or rollback
 * Note: Intentially to make this param case sensitive to be more safe
 */
export const getTargetScript = (req: Request) => {
	let targetScript = (req.body || {}).targetScript;
	if (!targetScript) {
		throw {
			statusCode: 400,
			message: `"targetScript" is mandatory in the request body, but found none.`
		};
	}
	//just make sure the script name matching the ones in db down the track.
	if (!targetScript.endsWith(".js")) targetScript = targetScript + ".js";
	return targetScript;
};

/**
 * Make sure the script to migrate up or rollback is the lastest scripts in this build.
 * So following scenarios will failed.
 * Person A merge script 1, person B merge scripts 2. Now we CANNOT migrate anymore. Need to revert one PR first inorder to migrate.
 *
 * In short, encourage ppl to over-communicate when it comes to db migrations.
 */
export const validateScriptLocally = async (targetScript: string) => {

	const scripts = await fs.promises.readdir(path.resolve(process.cwd(), "db/migrations"));
	//Sort by name, asc, so filename order has to be in order now.
	//So this now will be mandatory that, db migrtions scripts has to be alphabetically ordered.
	scripts.sort();
	const latestScriptsInRepo = scripts[scripts.length-1];

	if (targetScript.toLowerCase() !== latestScriptsInRepo.toLowerCase()) {
		throw {
			statusCode: 400,
			message: `"targetScript: ${targetScript}" doesn't match latest scripts in db/migrations ${latestScriptsInRepo}`
		};
	}

	logger.info(`Target script match latest scripts in repo ${targetScript}, validation passed`);

};

export enum DBMigrationType {
	UP = "UP",
	DOWN = "DOWN"
}

export const startDBMigration = async (targetScript: string, ops: DBMigrationType) => {
	logger.info(`All validation pass, now executing db migration script ${targetScript} for ${ops}`);
	const env = getDBMigrateEnv();
	if (ops !== DBMigrationType.UP && ops !== DBMigrationType.DOWN) {
		throw {
			statusCode: 500,
			message: `Fail to execute db migration type ${ops}`
		};
	}
	const cmd = ops === DBMigrationType.UP ?
		`./node_modules/.bin/sequelize db:migrate --env ${env}`
		: `./node_modules/.bin/sequelize db:migrate:undo:all --to ${targetScript} --env ${env}`;

	const { stdout, stderr } = await exec(cmd);
	const isSuccess = stderr ? false : true;
	if (isSuccess) {
		logger.info({ stdout, stderr }, `DB migration SUCCESSS!! -  ${targetScript}`);
	} else {
		logger.error({ stdout, stderr }, `DB migration FAILED!! -  ${targetScript}`);
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


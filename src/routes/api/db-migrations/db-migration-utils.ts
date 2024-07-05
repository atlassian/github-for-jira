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
 *
 * Functiont to get the param for db migration.
 *
 * Intentially to make this param case sensitive to be more safe
 *
 * @returns The common param in req.body `targetScript` to migrate up or down
 */
export const getTargetScript = (req: Request) : string => {
	const targetScript: string | null = (req.body || {}).targetScript;
	if (!targetScript) {
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw {
			statusCode: 400,
			message: `"targetScript" is mandatory in the request body, but found none.`
		};
	}
	return targetScript;
};

/* Make sure the script to migrate up or down is the latest (alphabetically) script in this build.
 * So the following scenarios will fail.
 * Person A merge script 1, person B merge scripts 2. Now we CAN NOT migrate anymore. Need to revert one PR first to migrate.
 *
 * In short, encourage ppl to over-communicate when it comes to DB migrations.
 */
export const validateScriptLocally = async (targetScript: string) => {

	const scripts = await fs.promises.readdir(path.resolve(process.cwd(), "db/migrations"));
	const latestScriptsInRepo = scripts[scripts.length-1];

	if (targetScript !== latestScriptsInRepo) {
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw {
			statusCode: 400,
			message: `"targetScript: ${targetScript}" doesn't match latest scripts in db/migrations ${latestScriptsInRepo}`
		};
	}

	logger.info(`Target script match latest scripts in repo ${targetScript}, validation passed`);

};

export enum DBMigrationType {
	UP = "UP",
	DOWN = "DOWN",
}

export const runDbMigration = async (targetScript: string, ops: DBMigrationType) => {
	const env = getDbConfigEnvForMigration();
	let cmd = "";
	switch (ops) {
		case DBMigrationType.UP:
			cmd = `./node_modules/.bin/sequelize db:migrate --env ${env}`;
			break;
		case DBMigrationType.DOWN:
			//Notes: `sequelize db:migrate:undo:all --to ${targetScript}` is inclusive, it means
			//it will rollback db to the state before ${targetScript},
			//so ${targetScript} will be rolled back as well.
			cmd = `./node_modules/.bin/sequelize db:migrate:undo:all --to ${targetScript} --env ${env}`;
			break;
		default:
			// eslint-disable-next-line @typescript-eslint/no-throw-literal
			throw {
				statusCode: 500,
				message: `Fail to execute db migration type`
			};
	}
	const { stdout, stderr } = await exec(cmd, {
		env: {
			...process.env
		}
	});
	const isSuccess = stderr ? false : true;
	return {
		isSuccess,
		stdout,
		stderr
	};
};

const getDbConfigEnvForMigration = () => {
	if (isNodeDev()) return "development";
	if (isNodeTest()) return "test";
	if (isNodeProd()) return "production-migrate";
	// eslint-disable-next-line @typescript-eslint/no-throw-literal
	throw {
		statusCode: 500,
		message: `Cannot determin node env for [${getNodeEnv()}]`
	};
};


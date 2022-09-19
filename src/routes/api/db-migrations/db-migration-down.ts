import { Request, Response } from "express";
import { getLogger } from "config/logger";
import safeJsonStringify from "safe-json-stringify";
import { sequelize } from "models/sequelize";
import { QueryTypes } from 'sequelize';
import { exec as execOrigin } from 'child_process';
import { promisify } from 'util';
import { isNodeDev, isNodeTest, isNodeProd, getNodeEnv } from "utils/is-node-env";

const exec = promisify(execOrigin);

import fs from "fs";
import path from "path";

const logger = getLogger("DBMigrationUp");

export const DBMigrationDown = async (req: Request, res: Response): Promise<void> => {
	try{

		const targetScript = getTargetScript(req);

		await validateScript(targetScript);

		logger.info(`All validation pass, now executing db migration rollback to ${targetScript}`);
		const { stdout, stderr } = await exec(`./node_modules/.bin/sequelize db:migrate:undo:all --to ${targetScript} --env ${mapEnv()}`);

		if (stderr) {
			logger.error({stdout, stderr}, `DB migration UP FAILED!! -  ${targetScript}`);
		} else {
			logger.info({stdout, stderr}, `DB migration UP SUCCESSS!! -  ${targetScript}`);
		}

		res.status(stderr ? 500: 200).send(`
			${stderr ? `FAILED!!!` : `SUCCESSS!!!`}
			----- stdout ------
			${stdout}
			----- stderr ------
			${stderr}
		`);

	}catch(e){
		logger.error("Error doing db migration up", e);
		res.status(e.statusCode || 500);
		res.send(safeJsonStringify(e));
	}
}

const getTargetScript = (req: Request) => {
	const targetScript = (req.body || {}).targetScript;
	if(!targetScript) {
		throw {
			statusCode: 400,
			message: `"targetScript" is mandatory in the request body, but found none.`
		}
	}
	logger.info(`Received DB target script to mgiration DOWN: ${targetScript}`);
	return targetScript;
}

const validateScript = async (targetScript: string) => {

	const scripts = await fs.promises.readdir(path.resolve(process.cwd(), "db/migrations"));
	scripts.sort(); //sort by name, asc, so filename order has to be in order now.
	const latestScriptsInRepo = scripts[scripts.length-1];

	if(!targetScript.endsWith(".js")) {
		targetScript =  targetScript + ".js";
	}

	if(targetScript.toLowerCase() !== latestScriptsInRepo.toLowerCase()) {
		throw {
			statusCode: 400,
			message: `Can ONLY undo most recent db migration script. "targetScript: ${targetScript}" doesn't match latest scripts in db/migrations folder ${latestScriptsInRepo}`
		}
	}

	const [lastScript] = await sequelize.query(`select "name" from "SequelizeMeta" order by "name" desc limit 1`);
	if(lastScript.length < 1) {
		throw {
			statusCode: 500,
			message: `There're no scripts to rollback to, stop rolling back. \n ${lastScript}`
		}
	}
	const scriptInDB = lastScript[0].name;
	if(scriptInDB.toLowerCase() !== targetScript) {
		throw {
			statusCode: 400,
			message: `The script asked to rollback ${targetScript} DOES NOT match latest script in db ${scriptInDB}. Stop rolling back`
		}
	}
	logger.info(`Target script match latest scripts in repo ${latestScriptsInRepo}, validation passed, can rollback to ${targetScript}`);

}

const mapEnv = () => {
	if(isNodeDev()) return "development";
	if(isNodeTest()) return "test";
	if(isNodeProd()) return "production-migrate";
	throw {
		statusCode: 500,
		message: `Cannot determin node env for [${getNodeEnv()}]`
	}
}

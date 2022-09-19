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

export const DBMigrationUp = async (req: Request, res: Response): Promise<void> => {
	try{

		const targetScript = getTargetScript(req);

		await validateScript(targetScript);

		logger.info(`All validation pass, now executing db migration script ${targetScript}`);
		const { stdout, stderr } = await exec(`npm run db:migrate:${mapEnv()}`);

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
	logger.info(`Received DB target script to mgiration up: ${targetScript}`);
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
			message: `"targetScript: ${targetScript}" doesn't match latest scripts in db/migrations ${latestScriptsInRepo}`
		}
	}

	const result = await sequelize.query(`select "name" from "SequelizeMeta" where "name" = :name`, {
		replacements: {name: targetScript},
		type: QueryTypes.SELECT
	});

	if(result.length > 0) {
		//throw {
		//	statusCode: 400,
		//	message: `"targetScript: ${targetScript} already present/migrated in db "SequelizeMeta" table`
		//}
	}

	logger.info(`Target script match latest scripts in repo ${latestScriptsInRepo}, validation passed`);

}

const mapEnv = () => {
	if(isNodeDev()) return "dev";
	if(isNodeTest()) return "test";
	if(isNodeProd()) return "prod";
	throw {
		statusCode: 500,
		message: `Cannot determin node env for [${getNodeEnv()}]`
	}
}

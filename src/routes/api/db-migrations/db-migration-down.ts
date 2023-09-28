import { Request, Response } from "express";
import { getLogger } from "config/logger";
import safeJsonStringify from "safe-json-stringify";
import { sequelize } from "models/sequelize";
import { QueryTypes } from "sequelize";
import { getTargetScript, validateScriptLocally, runDbMigration, DBMigrationType } from "./db-migration-utils";

const logger = getLogger("DBMigrationDown");

export const DBMigrationDown = async (req: Request, res: Response): Promise<void> => {

	try {

		const targetScript = getTargetScript(req);
		logger.info(`Received DB target script to mgiration DOWN: ${targetScript}`);

		await validateScriptLocally(targetScript);
		await validateScriptAgainstDB(targetScript);

		logger.info(`All validation pass, now executing db migration down - script ${targetScript}`);
		const { isSuccess, stdout, stderr } = await runDbMigration(targetScript, DBMigrationType.DOWN);
		if (isSuccess) {
			logger.info({ stdout, stderr }, `DB migration down SUCCESSS!! -  ${targetScript}`);
		} else {
			logger.error({ stdout, stderr }, `DB migration down FAILED!! -  ${targetScript}`);
		}

		res.status(isSuccess ? 200: 500).send(`
			${isSuccess ? `SUCCESSS!!!` : `FAILED!!!`}
			----- stdout ------
			${stdout}
			----- stderr ------
			${stderr}
		`);

	} catch (err: unknown){
		const e = err as { statusCode?: number };
		logger.error("Error doing db migration down", e);
		res.status(e.statusCode || 500);
		res.send(safeJsonStringify(e));
	}

};

type LastScript = {
	name: string;
}

const validateScriptAgainstDB = async (targetScript: string) => {
	const lastScript: LastScript[] = await sequelize.query(`select "name" from "SequelizeMeta" order by "name" desc limit 1`, {
		type: QueryTypes.SELECT
	});

	if (lastScript.length < 1) {
		throw {
			statusCode: 500,
			message: `There're no scripts in db to migration down, stop proceeding. \n}`
		};
	}

	const scriptInDB = lastScript[0].name;

	if (scriptInDB !== targetScript) {
		throw {
			statusCode: 400,
			message: `The script (${targetScript}) asked to migration down DOES NOT match latest script in db ${scriptInDB}. Stop rolling back`
		};
	}

	logger.info(`Target script ${targetScript} is indeed the last script in db, validation against db pass`);

};


import { Request, Response } from "express";
import { getLogger } from "config/logger";
import safeJsonStringify from "safe-json-stringify";
import { sequelize } from "models/sequelize";
import { QueryTypes } from "sequelize";
import { getTargetScript, validateScriptLocally, startDBMigration, DBMigrationType } from "./db-migration-utils";

const logger = getLogger("DBMigrationUp");

export const DBMigrationUp = async (req: Request, res: Response): Promise<void> => {

	try {

		const targetScript = getTargetScript(req);
		logger.info(`Received DB target script to mgiration UP: ${targetScript}`);

		await validateScriptLocally(targetScript);
		await validateScriptAgainstDB(targetScript);
		const {isSuccess, stdout, stderr} = await startDBMigration(targetScript, DBMigrationType.UP);

		res.status(isSuccess ? 200: 500).send(`
			${isSuccess ? `SUCCESSS!!!` : `FAILED!!!`}
			----- stdout ------
			${stdout}
			----- stderr ------
			${stderr}
		`);

	} catch (e){
		logger.error("Error doing db migration up", e);
		res.status(e.statusCode || 500);
		res.send(safeJsonStringify(e));
	}

};

const validateScriptAgainstDB = async (targetScript: string) => {

	const result = await sequelize.query(`select "name" from "SequelizeMeta" where "name" = :name`, {
		replacements: { name: targetScript },
		type: QueryTypes.SELECT
	});

	if (result.length > 0) {
		throw {
			statusCode: 400,
			message: `"targetScript: ${targetScript} already present/migrated in db "SequelizeMeta" table. DB query result ${safeJsonStringify(result)}`
		};
	}

	logger.info(`Target script match latest scripts in repo ${targetScript}, validation passed`);

};

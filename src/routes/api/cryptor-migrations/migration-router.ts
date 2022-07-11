import { Request, Response } from "express";
import { WhereOptions } from "sequelize";
import { Installation } from "models/installation";

const MAX_BATCH_SIZE = 10;
const MAX_TOTAL_LIMIT = 1_000;
const SAFE_GUARD_LOOP_COUNT = 100;

export const CryptorMigrationInstallationPost = async (req: Request, res: Response): Promise<void> => {

	let batchSize = parseInt(req.query.batchSize as string);
	let totalLimit = parseInt(req.query.totalLimit as string);
	const jiraHost = req.query.jiraHost as string;

	if (jiraHost) {
		if (batchSize || totalLimit) {
			res.status(400).send("Since 'jiraHost' is provided, we are only migrating one record for a time. Please do not specify 'batchSize' nor 'totalLimit'");
			return;
		}
		//updating single entry, hard code it to one
		totalLimit = 1;
		batchSize = 1;
	} else {
		if (isNaN(batchSize) || batchSize <0 || batchSize > MAX_BATCH_SIZE) {
			res.status(400).send(`Please provide a valid batchSize between 0 and ${MAX_BATCH_SIZE}, got ${batchSize}`);
			return;
		}
		if (isNaN(totalLimit) || totalLimit < 0 || totalLimit > MAX_BATCH_SIZE) {
			res.status(400).send(`Please provide a valid totalLimit between 0 and ${MAX_TOTAL_LIMIT}, got ${totalLimit}`);
			return;
		}
	}

	const toMigrateWhere: WhereOptions = {};
	if (jiraHost) {
		toMigrateWhere.jiraHost = jiraHost;
	} else {
		toMigrateWhere.encryptedSharedSecret = null;
	}


	let count = 0;
	let safeGuardCount = 0;
	while (count < totalLimit) {

		//safe guard
		if (safeGuardCount++ > SAFE_GUARD_LOOP_COUNT) throw new Error("Safe guard count exceeded " + SAFE_GUARD_LOOP_COUNT + ", right now is " + safeGuardCount);

		//fetch next batch
		const toMigratedInstallations: Installation[] = await Installation.findAll({
			where: toMigrateWhere,
			limit: batchSize
		});

		if (toMigratedInstallations.length === 0) {
			break;
		}

		for (const inst of toMigratedInstallations) {
			//copy from shared secret to encryptedSharedSecret to enable encryption
			inst.encryptedSharedSecret = inst.sharedSecret;
			//update db
			await inst.save();
			count++;
		}

		const remainingCount = await Installation.count({ where: { encryptedSharedSecret: null } });

		res.status(200).send(`Successfully updated ${count} entries encryptedSharedSecret and there're ${remainingCount} records`);

	}


};

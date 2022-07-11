import { Request, Response } from "express";
import { WhereOptions } from "sequelize";
import { Installation } from "models/installation";

const MAX_BATCH_SIZE = 10;
const MAX_TOTAL_LIMIT = 1_000;
const SAFE_GUARD_LOOP_COUNT = 100;

export const CryptorMigrationInstallationPost = async (req: Request, res: Response): Promise<void> => {

	const startTime = Date.now();

	req.log = req.log.child({
		operation: "migrate-installations-shared-secret"
	});

	let batchSize = parseInt(req.query.batchSize as string);
	let totalLimit = parseInt(req.query.totalLimit as string);
	const jiraHost = req.query.jiraHost as string;

	req.log.info(`Received to migration installation sharedSecret for`, { batchSize, totalLimit, jiraHost });
	if (jiraHost) {
		if (batchSize || totalLimit) {
			req.log.warn("Invalid params", { batchSize, totalLimit, jiraHost });
			res.status(400).send("Since 'jiraHost' is provided, we are only migrating one record for a time. Please do not specify 'batchSize' nor 'totalLimit'");
			return;
		}
		//updating single entry, hard code it to one
		totalLimit = 1;
		batchSize = 1;
		req.log.debug(`Found jiraHost, now hardcoded totalLimit and batchSize to 1`, { totalLimit, batchSize });
	} else {
		if (isNaN(batchSize) || batchSize < 0 || batchSize > MAX_BATCH_SIZE) {
			req.log.warn("Invalid params", { batchSize, totalLimit, jiraHost });
			res.status(400).send(`Please provide a valid batchSize between 0 and ${MAX_BATCH_SIZE}, got ${batchSize}`);
			return;
		}
		if (isNaN(totalLimit) || totalLimit < 0 || totalLimit > MAX_BATCH_SIZE) {
			req.log.warn("Invalid params", { batchSize, totalLimit, jiraHost });
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
	req.log.debug(`Using where to find installations`, { toMigrateWhere });

	req.log.info(`About to start migrating installation sharedSecret`);
	let count = 0;
	let safeGuardLoopCount = 0;
	while (count < totalLimit) {

		const batchStart = Date.now();

		const loopInfo = { batchSize, totalLimit, count, safeGuardLoopCount };

		//safe guard
		if (safeGuardLoopCount++ > SAFE_GUARD_LOOP_COUNT) {
			req.log.warn(`Seems something wrong with the code and it max out the safe guard loop`, loopInfo);
			throw new Error("Safe guard count exceeded " + SAFE_GUARD_LOOP_COUNT + ", right now is " + safeGuardLoopCount);
		}

		//fetch next batch
		req.log.debug(`To find for next batch of matching installation`, loopInfo);
		const toMigratedInstallations: Installation[] = await Installation.findAll({
			where: toMigrateWhere,
			limit: batchSize
		});

		if (toMigratedInstallations.length === 0) {
			req.log.info("No more matching batch found, all done, returning now...", loopInfo);
			break;
		}
		req.log.debug("Found matching installations to migrate", { ...loopInfo, found: toMigratedInstallations.length });

		for (const inst of toMigratedInstallations) {
			//copy from shared secret to encryptedSharedSecret to enable encryption
			inst.encryptedSharedSecret = inst.sharedSecret;
			//update db
			await inst.save();
			count++;
		}

		const batchElapsed = stopTimer(batchStart);
		const msg = `Successfully processed a batch of size ${batchSize}, batch index: ${count}, spent ${batchElapsed}\n`;
		req.log.info(msg);
		res.write(msg);

	}

	req.log.debug("All processed, now fetching remaining...");
	const remainingCount = await Installation.count({ where: { encryptedSharedSecret: null } });

	const finalMsg = `Successfully processed all batches for jiraHost: ${jiraHost}, batchSize: ${batchSize}, totalLimit: ${totalLimit}, with ${remainingCount} remaining. Spent ${stopTimer(startTime)}`;
	req.log.info(finalMsg);
	res.status(200).write(finalMsg);
	res.end();

};

const stopTimer = (startTime: number): string => {
	const endTime = Date.now();
	const milliSecondsDelta = endTime - startTime;
	return `${milliSecondsDelta} milli seconds`;
};

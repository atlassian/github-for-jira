import { Request, Response } from "express";
import { Installation } from "models/installation";

const MAX_BATCH_SIZE = 10_000;
const DEFAULT_BATCH_SIZE = 10;
const RESPONSE_BATCH_SIZE = 1000;

export const CryptorMigrationInstallationPost = async (req: Request, res: Response): Promise<void> => {
	const startTime = Date.now();

	const batchSize = getValidBatchSize(req);

	req.log = req.log.child({ operation: "migrate-installations-shared-secret", batchSize });

	//--------- finding all in current batch to process --------------
	req.log.info("About to start migrating installation sharedSecret");
	const installations: Installation[] = await Installation.findAll({
		limit: batchSize,
		where: {
			encryptedSharedSecret: null
		}
	});
	if (installations.length === 0) {
		req.log.info("No matching batch found, all done, returning now...");
		res.status(200).send("No matching found, nothing to do");
		return;
	}
	req.log.debug("Found matching installations to migrate, length " + installations.length);

	//--------- loop and save each one of them --------------
	let count = 0;
	for (const inst of installations) {
		//copy from shared secret to encryptedSharedSecret to enable encryption
		inst.encryptedSharedSecret = inst.sharedSecret;
		//update db
		await inst.save();
		req.log.info("Successfully migrated sharedSecret to encryptedSharedSecret");
		if (++count % RESPONSE_BATCH_SIZE === 0) {
			res.write(`Successfully migrated ${count} records now, still processing...`);
		}
	}

	req.log.debug("All processed, now fetching remaining...");
	const remainingCount = await Installation.count({ where: { encryptedSharedSecret: null } });

	const finalMsg = `Successfully processed all batches batchSize: ${batchSize}, with ${remainingCount} remaining. Spent ${stopTimer(startTime)}`;
	req.log.info(finalMsg);
	res.status(200).write(finalMsg);
	res.end();

};

const stopTimer = (startTime: number): string => {
	const endTime = Date.now();
	const milliSecondsDelta = endTime - startTime;
	return `${milliSecondsDelta} milli seconds`;
};

const getValidBatchSize = (req: Request): number => {
	const num = parseInt((req.body || {}).batchSize);
	if (isNaN(num)) return DEFAULT_BATCH_SIZE;
	if (num < 0) return DEFAULT_BATCH_SIZE;
	if (num > MAX_BATCH_SIZE) return DEFAULT_BATCH_SIZE;
	return num;
};

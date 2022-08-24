import { Request, Response } from "express";
import { Installation } from "models/installation";
import { Op } from "sequelize";

const MAX_BATCH_SIZE = 10_000;
const DEFAULT_BATCH_SIZE = 10;
const RESPONSE_BATCH_SIZE = 1000;

export const CryptorMigrationInstallationPost = async (req: Request, res: Response): Promise<void> => {
	const startTime = Date.now();

	const batchSize = getValidBatchSize(req);
	const lastId = getValidLastId(req);

	req.addLogFields({ operation: "migrate-installations-shared-secret", batchSize, lastId });

	//--------- finding all in current batch to process --------------
	req.log.info("About to start migrating installation sharedSecret");
	const installations: Installation[] = await Installation.findAll({
		limit: batchSize,
		where: {
			id: {
				[Op.gt]: lastId
			}
		},
		order: ["id"]
	});
	if (installations.length === 0) {
		req.log.info("No matching batch found, all done, returning now...");
		res.status(200).send("No matching found, nothing to do");
		return;
	}
	req.log.debug("Found matching installations to migrate, length " + installations.length);

	//--------- loop and save each one of them --------------
	let count = 0;
	let lastInst: Installation | null = null;
	for (const inst of installations) {
		//copy from shared secret to encryptedSharedSecret to enable encryption
		inst.encryptedSharedSecret = inst.sharedSecret;
		//update db
		await inst.save();
		lastInst = inst;
		if (++count % RESPONSE_BATCH_SIZE === 0) {
			res.write(`Successfully migrated ${count} records now, still processing...`);
		}
	}
	const newLastId: number = lastInst!.id;

	req.log.debug("All processed, now fetching remaining...");
	const remainingCount = await Installation.count({ where: { id: { [Op.gt]: newLastId } } });

	const finalMsg = `Successfully processed all batches batchSize: ${batchSize}, with ${remainingCount} remaining, newLastId is ${newLastId}. Spent ${stopTimer(startTime)}`;
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
	if (isNaN(num) || num < 0 || num > MAX_BATCH_SIZE) {
		return DEFAULT_BATCH_SIZE;
	}
	return num;
};

const getValidLastId = (req: Request): number => {
	const lastId = parseInt((req.body || {}).lastId);
	if (isNaN(lastId) || lastId < 0) {
		return 0;
	}
	return lastId;
};

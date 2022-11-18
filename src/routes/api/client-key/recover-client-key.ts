import { Request, Response } from "express";
import { Installation } from "models/installation";
import { getHashedKey } from "models/sequelize";
import { Op } from "sequelize";
import safeJsonStringify from "safe-json-stringify";
import axios from "axios";

const DEFAULT_BATCH_SIZE = 5000;

export const RecoverClientKeyPost = async (req: Request, res: Response): Promise<void> => {

	const startInstallationId = Number(req.query.startInstallationId) || 0;
	const batchSize = Number(req.query.batchSize) || DEFAULT_BATCH_SIZE;
	const overrideExisting = (Number(req.query.overrideExisting) || 0) === 1;

	res.status(200);

	res.write(`Start recovering client keys for installation starting from ${startInstallationId}\n`);

	const foundInstallations: Installation[] = await Installation.findAll({
		limit: batchSize,
		where: {
			... overrideExisting ? undefined : { jiraClientKey: null },
			"id": {
				[Op.gte]: startInstallationId
			}
		}
	});

	res.write(`Found ${foundInstallations.length} installations to process.\n`);

	let successCount = 0;
	let failCount = 0;

	for (const installation of foundInstallations) {

		try {

			const originClientKey = await getAndVerifyOriginClientKey(installation);
			installation.jiraClientKey = originClientKey;
			await installation.save();

			successCount++;
		} catch (e) {
			failCount++;
			res.write(`Something wrong when processing installation id: ${installation.id}: ${safeJsonStringify(e)}\n`);
		}

	}

	foundInstallations.sort((a,b)=>a.id - b.id);
	const lastId = foundInstallations.length === 0 ? NaN : foundInstallations[foundInstallations.length - 1].id;

	res.write(`All done, SUCCESS: ${successCount} - FAILED: ${failCount}, lastId: ${lastId}`);

	res.end();

};

const getAndVerifyOriginClientKey = async ({ id, jiraHost, clientKey: hashedClientKeyInDB }: Installation): Promise<string>  => {

	if (!jiraHost) {
		throw { msg: `Cannot find jiraHost`, id };
	}
	if (!jiraHost.endsWith("/")) jiraHost = jiraHost + "/";

	const result = await axios(`${jiraHost}plugins/servlet/oauth/consumer-info`);
	if (result.status != 200) {
		throw { msg: `Error fetching consumer-info`, jiraHost, id };
	}

	const text = result.data;
	if (!text) {
		throw { msg: `Response data empty`, jiraHost, id };
	}

	const [, originClientKey] = /<key>([0-9a-z-]+)<\/key>/gmi.exec(text) || [undefined, undefined];
	if (!originClientKey) {
		throw { msg: `Cannot extract origin client key`, jiraHost, id, text };
	}

	const hashedOriginClientKey = getHashedKey(originClientKey);
	if (hashedClientKeyInDB !== hashedOriginClientKey) {
		throw { msg: `keys not match after hashing`, jiraHost, id, hashedClientKeyInDB, hashedOriginClientKey, originClientKey };
	}

	return originClientKey;
};







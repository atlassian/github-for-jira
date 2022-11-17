import { Request, Response } from "express";
import { Installation } from "models/installation";
import { getHashedKey } from "models/sequelize";
import { Op } from "sequelize";
import safeJsonStringify from "safe-json-stringify";
import { Axios } from "axios";

const BATCH_SIZE = 5000;

export const RecoverClientKey = async (req: Request, res: Response): Promise<void> => {

	const { startInstallationId = 0 } = req.query as { startInstallationId: number | undefined };

	res.send(`Start recovering client keys for installation starting from ${startInstallationId}\n`);

	const foundInstallations: Installation[] = await Installation.findAll({
		limit: BATCH_SIZE,
		where: {
			"id": {
				[Op.gte]: startInstallationId
			}
		}
	});

	res.send(`Found ${foundInstallations.length} installations to process.\n`);

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
			res.send(`Something wrong when processing installation id: ${installation.id}: ${safeJsonStringify(e)}\n`);
		}

	}

	res.send(`All done, found ${successCount} success, ${failCount} fail.`);

	res.status(200);

};

const REGEX_CLIENT_KEY = /<key>([0-9a-z-]+)<\/key>/gmi;

const getAndVerifyOriginClientKey = async ({ id, jiraHost, clientKey: hashedClientKeyInDB }: Installation): Promise<string>  => {

	if (!jiraHost) {
		throw { msg: `Cannot find jiraHost`, id };
	}

	const result = await new Axios().get(`${jiraHost}/plugins/servlet/oauth/consumer-info`);
	if (result.status != 200) {
		throw { msg: `Error fetching consumer-info`, jiraHost, id };
	}

	const text = result.data;
	if (!text) {
		throw { msg: `Response data empty`, jiraHost, id };
	}

	const [, originClientKey] = REGEX_CLIENT_KEY.exec(text) || [undefined, undefined];
	if (!originClientKey) {
		throw { msg: `Cannot extra origin client key`, jiraHost, id, text };
	}

	const hashedOriginClientKey = getHashedKey(originClientKey);
	if (hashedClientKeyInDB !== hashedOriginClientKey) {
		throw { msg: `keys not match after hashing`, jiraHost, id, hashedClientKeyInDB, hashedOriginClientKey, originClientKey };
	}

	return originClientKey;
};







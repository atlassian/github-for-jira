import { Request, Response } from "express";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { getHashedKey } from "models/sequelize";
import { Op } from "sequelize";
import safeJsonStringify from "safe-json-stringify";
import axios from "axios";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getLogger } from "config/logger";
import { extractClientKey } from "./client-key-regex";
import { chunk } from "lodash";

const DEFAULT_BATCH_SIZE = 5000;
const DEFAULT_PARALLEL_SIZE = 10;

export const RecoverClientKeyPost = async (req: Request, res: Response): Promise<void> => {

	const log = getLogger("RecoverClientKeyPost");

	const startInstallationId = Number(req.query.startInstallationId) || 0;
	const batchSize = Number(req.query.batchSize) || DEFAULT_BATCH_SIZE;
	const overrideExisting = (Number(req.query.overrideExisting) || 0) === 1;
	const parallelSize = Number(req.query.parallelSize) || DEFAULT_PARALLEL_SIZE;

	res.status(200);

	res.write(`Start recovering client keys for installation starting from ${startInstallationId}\n`);

	const foundInstallations: Installation[] = await Installation.findAll({
		limit: batchSize,
		where: {
			... overrideExisting ? undefined : { plainClientKey: null },
			"id": {
				[Op.gte]: startInstallationId
			}
		},
		order: [ ["createdAt", "ASC"] ]
	});

	res.write(`Found ${foundInstallations.length} installations to process.\n`);

	let successCount = 0;
	let failCount = 0;

	const parallelChunks: Installation[][] = chunk(foundInstallations, parallelSize);

	for (const chunks of parallelChunks) {
		const errors: { id: number, err: object }[] = [];
		await Promise.all(chunks.map((installation: Installation) => {
			return (async () => {
				try {
					const plainClientKey = await getAndVerifyplainClientKey(installation);
					installation.plainClientKey = plainClientKey;
					await installation.save();
					log.info({ id: installation.id }, `Saved plainClientKey successfully for installation`);
					const subscriptions: Subscription[] = await Subscription.getAllForClientKey(installation.clientKey);
					for (const sub of subscriptions) {
						sub.plainClientKey = plainClientKey;
						await sub.save();
						log.info({ id: installation.id, subId: sub.id }, `Saved plainClientKey successfully for subscription`);
					}
					successCount++;
				} catch (err: unknown) {
					const e = err as { msg?: string };
					errors.push({ id: installation.id, err: e });
				}
			})();
		}));
		failCount += errors.length;
		for (const { id, err } of errors) {
			log.warn({ id, err }, `Failed at processing installation`);
			res.write(`SKIPPED: ${safeJsonStringify(err)}\n`);
		}
		res.write(".".repeat(chunks.length) + "\n");
	}

	foundInstallations.sort((a,b)=>a.id - b.id);
	const lastId = foundInstallations.length === 0 ? NaN : foundInstallations[foundInstallations.length - 1].id;

	res.write(`All done, SUCCESS: ${successCount} - FAILED: ${failCount}, lastId: ${lastId}`);

	res.end();

};

const getAndVerifyplainClientKey = async ({ id, jiraHost, clientKey: hashedClientKeyInDB }: Installation): Promise<string>  => {

	if (!jiraHost) {
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw { msg: `JiraHost missing`, id };
	}

	let text: string | undefined;
	try {
		//https://hello.atlassian.net/wiki/spaces/EDGE/pages/315794033/Whitelist+Proxy+-+Usage
		//use whitelist proxy so that we can hit xxx.jira-dev.com
		//Unless we don't care about those records in db?
		const proxy = `http://${process.env.WHITELIST_PROXY_HOST ?? "undefined"}:${process.env.WHITELIST_PROXY_PORT ?? "undefined"}`;
		const result = await axios.create({
			baseURL: jiraHost,
			httpAgent: new HttpProxyAgent(proxy),
			httpsAgent: new HttpsProxyAgent(proxy),
			proxy: false
		}).get("/plugins/servlet/oauth/consumer-info");
		text = result.data;
	} catch (err: unknown) {
		const e = err as { message?: string };
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw { msg: e.message, jiraHost, id };
	}

	if (!text) {
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw { msg: `Empty consumer-info`, jiraHost, id };
	}

	const plainClientKey = extractClientKey(text);
	if (!plainClientKey) {
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw { msg: `Client key xml extraction failed`, jiraHost, id, text };
	}

	const hashedplainClientKey = getHashedKey(plainClientKey);
	if (hashedClientKeyInDB !== hashedplainClientKey) {
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw { msg: `keys not match after hashing`, jiraHost, id, hashedClientKeyInDB, hashedplainClientKey, plainClientKey };
	}

	return plainClientKey;
};







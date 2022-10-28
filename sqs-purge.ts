/* eslint-disable no-console */
import axios from "axios";
import fs from "fs";
import { parse } from "yaml";


const purgeQueues = async () => {
	const file = fs.readFileSync("./docker-compose.yml", "utf8");

	const envVars = parse(file).services?.app?.environment;

	const queueUrls = Object.entries(envVars)
		.filter(([key, value]) => /^SQS_.*_QUEUE_URL$/.test(key) && value)
		.map((entry) => {
			const [, value] = entry;
			const url = new URL(String(value));
			return `${url.protocol}//localhost:${url.port}${url.pathname}?Action=PurgeQueue`;

		});

	console.info(`Purging queues: ${queueUrls.join(", ")}`);
	return Promise.all(
		queueUrls.map(async (value) => {
			try {
				await axios.get(value);
				console.info(`Queue ${value} purged...`);
				return Promise.resolve();
			} catch (e) {
				console.warn(`Queue ${value} not purged...`);
				return Promise.reject();
			}
		})
	);
};

void (async function main() {
	await purgeQueues();
	console.info("All queues purged.");
})();

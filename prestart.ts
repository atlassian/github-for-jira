import axios, { AxiosResponse } from "axios";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { isNodeProd } from "./src/util/is-node-env";

const envFileName = ".env";
const envFilePath = path.resolve(__dirname, envFileName);

const callTunnel = async () => {
	const results = await Promise.all([
		axios.get("http://localhost:4040/api/tunnels", { timeout: 300, responseType: "json" }).catch(() => undefined),
		axios.get("http://ngrok:4040/api/tunnels", { timeout: 300, responseType: "json" }).catch(() => undefined)
	]);

	const response = results.find((value?: AxiosResponse) => value?.status === 200) as AxiosResponse;
	return response || Promise.reject();
};

const wait = async (time = 0) => {
	console.info(`Waiting for ${time}ms`);
	return new Promise(resolve => setTimeout(resolve, time));
};

const waitForTunnel = async () => {
	// Call the service 3 times until ready
	const response = await callTunnel()
		.catch(callTunnel)
		.catch(callTunnel)
		.catch(() => undefined);
	if (response) {
		try {
			let envContents = fs.readFileSync(envFilePath, { encoding: "utf-8" });
			const tunnel = response.data.tunnels.find(tunnel => tunnel.public_url.startsWith("https"));
			const ngrokDomain = tunnel.public_url;
			console.info(`ngrok forwarding ${ngrokDomain} to ${tunnel.config.addr}`);
			envContents = envContents.replace(/APP_URL=.*/, `APP_URL=${ngrokDomain}`);
			envContents = envContents.replace(/WEBHOOK_PROXY_URL=.*/, `WEBHOOK_PROXY_URL=${ngrokDomain}/github/webhooks`);
			fs.writeFileSync(envFilePath, envContents);
			console.info(`Updated ${envFileName} file to use ngrok domain '${ngrokDomain}'.`);
		} catch (e: unknown) {
			console.info(`'${envFilePath}' not found, skipping...`);
		}
	} else {
		console.info(`Ngrok not running, skipping updating ${envFileName} file.`);
	}
};

const callQueues = async () => {
	const queueUrls = Object.entries(process.env)
		.filter(([key, value]) => /^SQS_.*_QUEUE_URL$/.test(key) && value)
		.map(([_key, value]) => `${value}?Action=GetQueueUrl&QueueName=${value!.split("/").pop()}`);
	console.info(`Checking for localstack initialization...`);
	if (queueUrls.length) {
		const url = new URL(queueUrls[0]);
		const response = await axios.get(`${url.protocol}//${url.host}/health`, { responseType: "json" });
		if (response.data?.services?.sqs !== "running") {
			console.info("localstack not initialized.");
			return Promise.reject();
		}
		console.info(`localstack initialized.`);
	}

	console.info(`Calling queues: ${queueUrls.join(", ")}`);
	return Promise.all(
		queueUrls.map(async (value) => {
			try {
				await axios.get(value);
				console.info(`Queue ${value} is ready...`);
				return Promise.resolve();
			} catch (e: unknown) {
				console.warn(`Queue ${value} not ready...`);
				return Promise.reject();
			}
		})
	);
};

const waitForQueues = async () => {
	console.info("Waiting on SQS queues to be available...");
	// Call localstack 5 times until ready
	await callQueues()
		.catch(() => wait(5000).then(callQueues))
		.catch(() => wait(5000).then(callQueues))
		.catch(() => wait(5000).then(callQueues))
		.catch(() => wait(5000).then(callQueues));
	console.info("All queues ready.");
};

const createEnvFile = async () => {
	if (!isNodeProd() && !fs.existsSync(envFilePath)) {
		return new Promise<void>((resolve, reject) => {
			exec("./.husky/create-env.sh", (error, stdout) => {
				if (error) {
					reject(error);
					return;
				}
				console.info(stdout);
				resolve();
			});
		});
	}
};

// Check to see if ngrok is up and running
(async function main() {
	try {
		await createEnvFile();
		await Promise.all([
			waitForTunnel(),
			waitForQueues()
		]);
		process.exit();
	} catch (e: unknown) {
		process.exit(1);
	}
})();

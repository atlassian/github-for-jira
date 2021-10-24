import envVars from "./src/config/env";
import axios, { AxiosResponse } from "axios";
import * as fs from "fs";
import * as path from "path";
import { isNodeDev } from "./src/util/isNodeEnv";

const envFilePath = path.resolve(__dirname, ".env");

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
	// Does .env exist?
	if (isNodeDev() && !fs.existsSync(envFilePath)) {
		console.error(`.env file doesn't exist. Please create it following the steps in the CONTRIBUTING.md file.`);
		process.exit(1);
	}

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
			envContents = envContents.replace(/WEBHOOK_PROXY_URL=.*/, `WEBHOOK_PROXY_URL=${ngrokDomain}/github/events`);
			fs.writeFileSync(envFilePath, envContents);
			console.info(`Updated .env file to use ngrok domain ${ngrokDomain}.`);
		} catch (e) {
			console.info(`'${envFilePath}' not found, skipping...`);
		}
	} else {
		console.info("Ngrok not running, skipping updating .env file.");
	}
};

const callQueues = async () => {
	const URLs = Object.keys(envVars)
		.filter(key => /^SQS_.*_QUEUE_URL$/.test(key))
		.map(key => envVars[key]);
	console.info(`Checking for localstack initialization...`);
	if (URLs.length) {
		const url = new URL(URLs[0]);
		const response = await axios.get(`${url.protocol}//${url.host}/health`, { responseType: "json" });
		if (response.data?.services?.sqs !== "running") {
			console.info("localstack not initialized.");
			return Promise.reject();
		}
		console.info(`localstack initialized.`);
	}

	console.info(`Calling queues: ${URLs.join(", ")}`);
	return Promise.all(
		URLs.map(async (value) => {
			try {
				await axios.get(value);
				console.info(`Queue ${value} is ready...`);
				return Promise.resolve();
			} catch (e) {
				console.warn(`Queue ${value} not ready...`);
				return Promise.reject();
			}
		})
	);
};

const waitForQueues = async () => {
	console.info("Waiting on SQS queues to be available...");
	// Call localstack 3 times until ready
	await callQueues()
		.catch(() => wait(5000).then(callQueues))
		.catch(() => wait(5000).then(callQueues))
		.catch(() => wait(5000).then(callQueues))
		.catch(() => wait(5000).then(callQueues));
	console.info("All queues ready.");
};

// Check to see if ngrok is up and running
(async function main() {

	try {
		await Promise.all([
			waitForTunnel(),
			waitForQueues()
		]);
		process.exit();
	} catch (e) {
		process.exit(1);
	}
})();

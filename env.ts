import axios, { AxiosResponse } from "axios";
import * as fs from "fs";

const filepath = ".env";

const call = async () => {
	const results:(AxiosResponse | undefined)[] = await Promise.all([
		axios.get("http://localhost:4040/api/tunnels", { timeout: 300, responseType: "json" }).catch(() => undefined),
		axios.get("http://ngrok:4040/api/tunnels", { timeout: 300, responseType: "json" }).catch(() => undefined)
	]);

	const response = results.find((value?: AxiosResponse) => value?.status === 200) as AxiosResponse;
	return response || Promise.reject();
};

// Check to see if ngrok is up and running
(async function main() {

	// Does .env exist?
	if (!fs.existsSync(filepath)) {
		console.error(`.env file doesn't exist. Please create it following the steps in the CONTRIBUTING.md file.`);
		process.exit(1);
	}

	// Call the service 3 times until ready
	const response = await call()
		.catch(call)
		.catch(call)
		.catch(() => undefined);
	if (response) {
		const tunnel = response.data.tunnels.find(tunnel => tunnel.public_url.startsWith("https"));
		const ngrokDomain = tunnel.public_url;
		console.info(`ngrok forwarding ${ngrokDomain} to ${tunnel.config.addr}`);

		let contents = fs.readFileSync(filepath, { encoding: "utf-8" });
		contents = contents.replace(/APP_URL=.*/, `APP_URL=${ngrokDomain}`);
		contents = contents.replace(/WEBHOOK_PROXY_URL=.*/, `WEBHOOK_PROXY_URL=${ngrokDomain}/github/events`);
		fs.writeFileSync(filepath, contents);
		console.info(`Updated .env file to use ngrok domain ${ngrokDomain}. Full content of .env: \n${contents}`);
	} else {
		console.info("Ngrok not running, skipping updating .env file.");
	}

	process.exit();
})();

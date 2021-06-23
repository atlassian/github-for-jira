import axios, { AxiosResponse } from "axios";
import * as fs from "fs";
const filepath = ".env";

// Check to see if ngrok is up and running
(async function main() {

  // Does .env exists?
  if (!fs.existsSync(filepath)) {
    console.error(`.env file doesn't exist. Please create it following the steps in the CONTRIBUTING.md file.`);
    process.exit(1);
  }

  try {
    const results = await Promise.all([
      axios.get("http://localhost:4040/api/tunnels", { responseType: "json" }).catch(() => ({})),
      axios.get("http://ngrok:4040/api/tunnels", { responseType: "json" }).catch(() => ({}))
    ]);
    const response = results.find((value: AxiosResponse) => value.status === 200) as AxiosResponse;
    if (!response) {
      console.info("Ngrok not running, skipping updating .env file.");
    }
    const tunnel = response.data.tunnels.find(tunnel => tunnel.public_url.startsWith("https"));
    const ngrokDomain = tunnel.public_url;
    console.info(`ngrok forwarding ${ngrokDomain} to ${tunnel.config.addr}`);

    const contents = fs.readFileSync(filepath, { encoding: "utf-8" });
    contents.replace(/APP_URL=.*/, `APP_URL=${ngrokDomain}`);
    contents.replace(/WEBHOOK_PROXY_URL=.*/, `WEBHOOK_PROXY_URL=${ngrokDomain}/github/events`);
    fs.writeFileSync(filepath, contents);
    console.info(`Updated .env file to use ngrok domain ${ngrokDomain}`);
  } catch (e) {
    console.error(e);
  }
  process.exit();
})();

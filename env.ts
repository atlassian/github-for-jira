import fs from "fs";
import axios from "axios";

const filepath = ".env";

// Check to see if ngrok is up and running
axios.get("http://localhost:4040/api/tunnels", { responseType: "json" })
  .then(response => {
    const tunnel = response.data.tunnels.find(tunnel => tunnel.public_url.startsWith('https'));
    const ngrokDomain = tunnel.public_url;
    console.log(`ngrok forwarding ${ngrokDomain} to ${tunnel.config.addr}`);

    // Does .env exists?
    if (fs.existsSync(filepath)) {
      const contents = fs.readFileSync(filepath, { encoding: "utf-8" });
      contents.replace(/APP_URL=.*/, `APP_URL=${ngrokDomain}`);
      contents.replace(/WEBHOOK_PROXY_URL=.*/, `WEBHOOK_PROXY_URL=${ngrokDomain}/github/events`);
      fs.writeFileSync(filepath, contents);
    }
    console.log(`Updated .env file to use ngrok domain ${ngrokDomain}`);
  }, () => console.log('Ngrok not running, skipping updating .env file.'))
  .finally(() => process.exit());

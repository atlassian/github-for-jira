import { Application, Probot } from "probot";
import { setupGithubWebhooks } from "./github/webhooks";
import { overrideProbotLoggingMethods } from "config/logger";
import { setupFrontend } from "./app";
import express from "express";
import bodyParser from "body-parser";

export async function setupApp(app: Application): Promise<Application> {
	setupGithubWebhooks(app);
	setupFrontend(app);
	return app;
}

let c = 0;

export const configureAndLoadApp = (probot: Probot) => {
	overrideProbotLoggingMethods(probot.logger);
	probot.load(setupApp);
	probot.webhook.on("error", (error: Error) => {
		probot.logger.error({ error }, "Webhook Error");
	});

	const wrapperApp = express();

	wrapperApp.use(bodyParser());

	wrapperApp.use((req, res, next) => {

		console.log(req.url);

		const isWebHookReq = req.url === "/github/events" && req.method === "POST";

		if (!isWebHookReq) {
			next();
			return;
		}

		if (c++ % 2 === 0) {
			console.log(`hello wrapper ${c}`, { url: req.url, body: req.body });
			//do something webhook
			res.send("ok");
			return;
		} else {
			req.url = "/github/events-legacy";
			next("route");
		}
	});

	wrapperApp.use(probot.server);

	probot.server = wrapperApp;

};



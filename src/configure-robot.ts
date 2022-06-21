import { Application, Probot } from "probot";
import { setupGithubWebhooks } from "./github/webhooks";
import { overrideProbotLoggingMethods } from "config/logger";
import { setupFrontend } from "./app";
import express from "express";
import bodyParser from "body-parser";
import { booleanFlag, BooleanFlags } from "./config/feature-flags";

export async function setupApp(app: Application): Promise<Application> {
	setupGithubWebhooks(app);
	setupFrontend(app);
	return app;
}

export const configureAndLoadApp = async (probot: Probot) => {

	overrideProbotLoggingMethods(probot.logger);
	probot.load(setupApp);
	probot.webhook.on("error", (error: Error) => {
		probot.logger.error({ error }, "Webhook Error");
	});

	const deprecateProbotWebhook = await booleanFlag(BooleanFlags.DEPRECATE_PROBOT_WEBHOOK, false);
	if (deprecateProbotWebhook === true) {
		wrapProbotWithCustomWebhookHandler(probot);
	}

};

const wrapProbotWithCustomWebhookHandler = async (probot: Probot) => {

	const wrapperApp = express();

	wrapperApp.use(bodyParser());

	wrapperApp.use((req, res, next) => {

		const isWebHookReq = req.url === "/github/events" && req.method === "POST";

		if (!isWebHookReq) {
			next();
			return;
		}

		const eventName = req.headers["x-github-event"];

		if (eventName === "issue_comment") {
			console.log(`hello wrapper issue_comment`, { url: req.url, headers: req.headers, body: req.body });
			/*
			 * TODO:
			 *		1. Directly handler webhook here
			 *		2. Potentially we need to duplicate or temporary embedded any middleware we need here,
			 *				as it won't go to the probot express at all
			 */
			//IMPORTANT!!!
			//DO NOT CALL next here.
			res.send("ok");
			return;
		} else if (eventName === "push") {
			console.log(`hello wrapper push`, { url: req.url, headers: req.headers, body: req.body });
			//like above, handler push event ...
			//IMPORTANT!!!
			//DO NOT CALL next here.
			res.send("ok");
			return;
		} else {
			next();
		}
	});

	wrapperApp.use(probot.server);

	probot.server = wrapperApp;
};

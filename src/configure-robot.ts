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

//for local testing
//let c = 0;

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

		//if (c++ % 2 === 0) {
		console.log(`hello wrapper`, { url: req.url, headers: req.headers, body: req.body });
		/*
			 * TODO:
			 *		1. Directly handler webhook here
			 *		2. Potentially we need to duplicate or temporary embedded any middleware we need here,
			 *				as it won't go to the probot express at all
			 */
		res.send("ok");
		//IMPORTANT!!!
		//DO NOT CALL next here.
		return;
		//} else {
		//	next();
		//}
	});

	wrapperApp.use(probot.server);

	probot.server = wrapperApp;
};

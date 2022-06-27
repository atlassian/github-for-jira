import { Application, Probot } from "probot";
import { setupGithubWebhooks } from "./github/webhooks";
import { setupFrontend } from "./app";
import { overrideProbotLoggingMethods } from "config/logger";

export async function setupApp(app: Application): Promise<Application> {
	setupGithubWebhooks(app);
	setupFrontend(app);
	return app;
}

export const configureAndLoadApp = (probot: Probot) => {
	overrideProbotLoggingMethods(probot.logger);
	probot.load(setupApp);
	probot.webhook.on("error", (error: Error) => {
		probot.logger.error({ error }, "Webhook Error");
	});
};



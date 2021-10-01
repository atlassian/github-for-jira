import {Application, Probot} from "probot";
import setupFrontend from "./frontend";
import setupGitHub from "./github";
import {overrideProbotLoggingMethods} from "./config/logger";

export async function setupApp(app: Application): Promise<Application> {
	setupGitHub(app);
	setupFrontend(app);

	return app;
}

export default function configureAndLoadApp(probot: Probot) {
	probot.load(setupApp);
	probot.webhook.on("error", (err: Error) => {
		probot.logger.error(err, "Webhook Error");
	});
	overrideProbotLoggingMethods(probot.logger);
}



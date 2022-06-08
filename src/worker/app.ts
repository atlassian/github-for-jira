// FIXME: This is all a bit of a hack to get access to a Probot Application
//        instance, mainly to use the `auth()` method. Probot needs refactored
//        so that method is more easily accessible.

import { Application, createProbot } from "probot";
import { findPrivateKey } from "probot/lib/private-key";
import { HealthcheckRouter } from "routes/healthcheck/healthcheck-router";
import { overrideProbotLoggingMethods } from "config/logger";

export const probot = createProbot({
	id: Number(process.env.APP_ID),
	cert: findPrivateKey() || undefined,

	// These aren't needed by worker process
	secret: undefined,
	port: Number(process.env.WORKER_PORT) || Number(process.env.PORT) || 8081,
	webhookPath: undefined,
	webhookProxy: undefined
});

// TODO: remove probot from here, just use express
const App = async (app: Application): Promise<Application> => {
	const router = app.route();
	router.use(HealthcheckRouter);
	return app;
};

// We are always behind a proxy, but we want the source IP
probot.server.set("trust proxy", true);

overrideProbotLoggingMethods(probot.logger);

// Load an empty app so we can get access to probot's auth handling
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const workerApp = probot.load(App);


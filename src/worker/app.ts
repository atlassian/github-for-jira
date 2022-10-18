import express, { Express } from "express";
import { HealthcheckRouter } from "routes/healthcheck/healthcheck-router";
import { overrideProbotLoggingMethods } from "config/logger";

export const createWorkerServerApp = (): Express => {
	const app = express();
	// We are always behind a proxy, but we want the source IP
	app.set("trust proxy", true);
	app.use(HealthcheckRouter);
	return app;
}

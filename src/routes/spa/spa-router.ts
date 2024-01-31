import { Router, static as Static } from "express";
import path from "path";
import fs from "fs/promises";
import { envVars } from "config/env";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { JwtHandlerWithoutQsh } from "../../rest/middleware/jwt/jwt-handler";

export const SpaRouter = Router();

const rootPath = process.cwd();

//Assets from within the new spa experience in /spa/build/static
SpaRouter.use("/static", Static(path.join(rootPath, 'spa/build/static')));

//Because it is Single Page App, for all routes to /spa/screen1 , /spa/screen1/step2 should render the spa index.html anyway
let indexHtmlContent: string = "";

SpaRouter.use(JwtHandlerWithoutQsh);
SpaRouter.use("/*", async (_, res) => {
	const { jiraHost } = res.locals;
	const featureFlags = {
		ENABLE_5KU_BACKFILL_PAGE: await booleanFlag(BooleanFlags.ENABLE_5KU_BACKFILL_PAGE, jiraHost)
	};

	if (!indexHtmlContent) {
		indexHtmlContent = await fs.readFile(path.join(process.cwd(), "spa/build/index.html"), "utf-8");
	}

	const updatedContentWithFFValues = indexHtmlContent
		.replace("##SPA_APP_ENV##", envVars.MICROS_ENVTYPE || "")
		.replace("##SENTRY_SPA_DSN##", envVars.SENTRY_SPA_DSN || "")
		.replace("\"##FRONTEND_FEATURE_FLAGS##\"", JSON.stringify(featureFlags));

	res.status(200).send(updatedContentWithFFValues);
});

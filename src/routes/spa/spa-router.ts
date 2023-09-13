import { Router, static as Static } from "express";
import path from "path";
import fs from "fs/promises";
import { envVars } from "config/env";
import { createHashWithSharedSecret } from "utils/encryption";
import { JwtHandlerWithoutQsh } from "../../rest/middleware/jwt/jwt-handler";

export const SpaRouter = Router();

const rootPath = process.cwd();

//Assets from within the new spa experience in /spa/build/static
SpaRouter.use("/static", Static(path.join(rootPath, 'spa/build/static')));

//Because it is Single Page App, for all routes to /spa/screen1 , /spa/screen1/step2 should render the spa index.html anyway
let indexHtmlContent: string = "";

SpaRouter.use(JwtHandlerWithoutQsh);
SpaRouter.use("/*", async (_, res) => {
	const { jiraHost, accountId } = res.locals;

	if (!indexHtmlContent) {
		indexHtmlContent = (await fs.readFile(path.join(process.cwd(), "spa/build/index.html"), "utf-8"))
			.replace("##SPA_APP_ENV##", envVars.MICROS_ENVTYPE || "")
			.replace("##SENTRY_SPA_DSN##", envVars.SENTRY_SPA_DSN || "")
			.replace("##ATLASSIAN_ACCOUNT_ID##", accountId || "")
			.replace("##HASHED_JIRAHOST##", createHashWithSharedSecret(jiraHost));
	}
	res.status(200).send(indexHtmlContent);
});

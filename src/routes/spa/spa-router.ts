import { Router, static as Static } from "express";
import path from "path";
import fs from "fs/promises";
import { envVars } from "config/env";

export const SpaRouter = Router();

const rootPath = process.cwd();

//Assets from within the new spa experience in /spa/build/static
SpaRouter.use("/static", Static(path.join(rootPath, 'spa/build/static')));

//Because it is Single Page App, for all routes to /spa/screen1 , /spa/screen1/step2 should render the spa index.html anyway
let indexHtmlContent: string = "";
SpaRouter.use("/*", async function SpaIndexHtml(_, res) {
	if (!indexHtmlContent) {
		indexHtmlContent = (await fs.readFile(path.join(process.cwd(), "spa/build/index.html"), "utf-8")).replace("##SPA_APP_ENV##", envVars.MICROS_ENVTYPE || "");
	}
	res.status(200).send(indexHtmlContent);
});

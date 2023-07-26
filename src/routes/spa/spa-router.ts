import { Router, static as Static } from "express";
import path from "path";
import fs from "fs";
import { envVars } from "config/env";

export const SpaRouter = Router();

const rootPath = process.cwd();

//Asset from within the new spa expereicen in /spa/build/static
SpaRouter.use("/static", Static(path.join(rootPath, 'spa/build/static')));

//Because it is Single Page App, for all routes to /spa/screen1 , /spa/screen1/step2 should render the spa index.html anyway
const ENV_KEY = "##SPA_APP_ENV##";
const indexHtmlContent = fs.readFileSync(path.join(process.cwd(), "spa/build/index.html"), "utf-8").replace(ENV_KEY, envVars.MICROS_ENVTYPE || "");

SpaRouter.use("/*", function SpaIndexHtml(_, res) {
	res.status(200).send(indexHtmlContent);
});

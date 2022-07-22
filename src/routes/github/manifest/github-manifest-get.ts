import { Request, Response } from "express";
import { existsSync, readFileSync } from "fs";
import { JsonPlaceholderReplacer } from "json-placeholder-replacer";
import { resolve } from "path";
import { v4 as uuidv4 } from "uuid";
import { envVars } from "~/src/config/env";

export const GithubManifestGet = async (req: Request, res: Response) => {
	const filepath = resolve(process.cwd(), "ghe-app-manifest.template.json");
	const gheHost = req.query.gheHost;
	if (existsSync(filepath)) {
		const gheAppManifest = JSON.parse(readFileSync(filepath, "utf-8"));
		const placeHolderReplacer = new JsonPlaceholderReplacer();
		placeHolderReplacer.addVariableMap({
			APP_HOST: envVars.APP_URL,
			UUID: uuidv4()
		});
		req.session.temp = { gheHost };
		res.json(placeHolderReplacer.replace(gheAppManifest));
	} else {
		throw new Error(`GHE app manifest template not found.`);
	}
};
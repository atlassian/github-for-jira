import { Request, Response } from "express";
import { existsSync, readFileSync } from "fs";
import { JsonPlaceholderReplacer } from "json-placeholder-replacer";
import { resolve } from "path";
import { v4 as uuidv4 } from "uuid";
import { envVars } from "~/src/config/env";

export const JiraManifestGet = async (_req: Request, res: Response) => {
	const filepath = resolve(process.cwd(), "ghe-app-manifest.template.json");
	const gheHost = "http://github.internal.atlassian.com"; // Todo: Fetch from query paramter
	if (existsSync(filepath)) {
		const gheAppManifest =  JSON.parse(readFileSync(filepath, "utf-8"));
		const placeHolderReplacer = new JsonPlaceholderReplacer();
		placeHolderReplacer.addVariableMap({
			GHE_HOST: gheHost,
			APP_HOST: envVars.APP_URL,
			UUID: uuidv4()
		});
		res.cookie("ghe_host", gheHost, { maxAge: 60*60*1000, httpOnly: true, sameSite: "none", secure: true });
		// Todo: read from res.locals or somewhere
		res.json(placeHolderReplacer.replace(gheAppManifest));
	} else {
		throw new Error(
			`GHE app manifest template does not exists.`
		);
	}
};
/*
"callback_urls": [
	"https://example.com/callback"  https://docs.github.com/en/enterprise-server@3.1/admin/release-notes
], */
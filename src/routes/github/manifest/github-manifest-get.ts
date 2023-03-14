import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { envVars } from "~/src/config/env";

export const GithubManifestGet = async (req: Request, res: Response) => {
	const appHost = envVars.APP_URL;
	const uuid = uuidv4();

	res.render("github-manifest.hbs", {
		nonce: res.locals.nonce,
		appHost,
		uuid,
		gheHost: req.session.temp?.gheHost,
		title: "Creating manifest and redirecting to your GitHub Enterprise Server instance"
	});
};
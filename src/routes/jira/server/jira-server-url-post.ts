import { Request, Response } from "express";
import axios from "axios";
import { GitHubServerApp } from "models/github-server-app";
import { isValidUrl } from "utils/is-valid-url";

export const JiraServerUrlPost = async (
	req: Request,
	res: Response
): Promise<void> => {
	const { gheServerURL, installationId } = req.body;

	req.log.debug(`Verifying provided GHE server url ${gheServerURL} is a valid URL`);
	const isGheUrlValid = isValidUrl(gheServerURL);

	if (isGheUrlValid) {
		try {
			const gitHubServerApps = await GitHubServerApp.getAllForGitHubBaseUrl(gheServerURL, installationId);

			if (gitHubServerApps?.length) {
				req.log.debug(`GitHub apps found for url: ${gheServerURL}. Redirecting to Jira list apps page.`);
				res.status(200).send({ success: true, moduleKey: "github-list-apps-page" });
			} else {
				req.log.debug(`No existing GitHub apps found for url: ${gheServerURL}. Making request to provided url.`);
				await axios.get(gheServerURL);
				res.status(200).send({ success: true, moduleKey: "github-app-creation-page" });
			}
		} catch (err) {
			req.log.debug(`Something went wrong: ${gheServerURL}`, err);
			// TODO - adding error mapping (create confluence page with error codes)
			res.status(200).send({ success: false, error: "Something went wrong!!!!" });
		}
	} else {
		req.log.error(`Provided gheServerURL ${gheServerURL} is not a valid url`);
		res.status(200).send({ success: false, error: "Provided URL is not valid." });
	}
};

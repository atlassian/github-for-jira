import { Request, Response } from "express";
import axios from "axios";
import { GitHubServerApp } from "models/github-server-app";
import { isValidUrl } from "utils/is-valid-url";

export const JiraServerUrlPost = async (
	req: Request,
	res: Response
): Promise<void> => {
	const { gheServerURL, installationId } = req.body;
	const isGheUrlValid = isValidUrl(gheServerURL);

	req.log.info(`Verifying provided GHE server url: ${gheServerURL}`);

	if (isGheUrlValid) {
		try {
			const gitHubServerApps = await GitHubServerApp.getAllForGitHubBaseUrl(gheServerURL, installationId);

			if (gitHubServerApps?.length) {
				req.log.info(`GitHub apps found for url: ${gheServerURL}. Redirecting to Jira list apps page.`);
				res.status(200).send({ success: true, moduleKey: "github-list-apps-page" });
			} else {
				req.log.info(`No existing GitHub apps found for url: ${gheServerURL}. Redirecting to Jira app creation page.`);

				const isValid = await axios.get(gheServerURL);
				req.log.info(`Successfully verified GHE server url: ${gheServerURL}`, isValid);

				res.status(200).send({ success: true, moduleKey: "github-app-creation-page"  });
			}
		} catch (err) {
			req.log.error(`Something went wrong: ${gheServerURL}`);
			// TODO - adding error mapping (create confluence page with error codes)
			res.status(200).send({ success: false, error: "Something went wrong!!!!" });
		}
	} else {
		req.log.error(`Provided gheServerURL ${gheServerURL} is not a valid url`);
		res.status(200).send({ success: false, error: "Provided URL is not valid." });
	}
};

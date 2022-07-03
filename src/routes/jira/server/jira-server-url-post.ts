import { Request, Response } from "express";
import axios from "axios";
import { GitHubServerApp } from "models/github-server-app";

export const JiraServerUrlPost = async (
	req: Request,
	res: Response
): Promise<void> => {
	// todo - validate url
	const { gheServerURL, installationId } = req.body;
	req.log.info(`Verifying provided GHE server url: ${gheServerURL}`, installationId);

	try {
		const gitHubServerApps = await GitHubServerApp.getAllForGitHubBaseUrl(gheServerURL, installationId);

		if (gitHubServerApps?.length) {
			req.log.info(`GitHub apps found for url: ${gheServerURL}. Redirecting to Jira list apps page.`);
			res.status(200).send({ moduleKey: "github-list-apps-page" });
		} else {
			req.log.info(`No existing GitHub apps found for url: ${gheServerURL}. Redirecting to Jira app creation page.`);

			const isValid = await axios.get(gheServerURL);
			req.log.info(`Successfully verified GHE server url: ${gheServerURL}`, isValid);

			res.status(200).send({ success: true, moduleKey: "github-app-creation-page"  });
		}
	} catch (err) {
		req.log.error(`Something went wrong: ${gheServerURL}`);
		// TODO - adding error mapping (create confluence page with error codes)
		res.status(200).send({ success: false, error: "Something went wrong!!!!", err });
	}
};

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

	// TODO - adding error mapping (create confluence page with error codes)
	try {
		const gitHubServerApps = await GitHubServerApp.getAllForGitHubBaseUrl(gheServerURL, installationId);

		if (gitHubServerApps?.length) {
			req.log.info(`GitHub apps found for url: ${gheServerURL}. Redirecting to Jira list apps page.`);
			res.status(200).send({ moduleKey: "github-list-apps-page" });
		} else {
			req.log.info(`No existing GitHub apps found for url: ${gheServerURL}. Redirecting to Jira app creation page.`);

			await axios.get(gheServerURL);
			req.log.info(`Successfully verified GHE server url: ${gheServerURL}`);

			res.status(200).send({ success: true, moduleKey: "github-app-creation-page"  });
		}
	} catch (e) {
		req.log.error(`Something went wrong: ${gheServerURL}`);
		res.status(200).send({ error: "Something went wrong" });
	}
};

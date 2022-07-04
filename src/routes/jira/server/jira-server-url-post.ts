import { Request, Response } from "express";
import axios from "axios";
import { GitHubServerApp } from "models/github-server-app";
import { isValidUrl } from "utils/is-valid-url";

const gheServerUrlErrors = {
	codeOrStatus: {
		ENOTFOUND: {
			message: "Unable to make a request to provided URL. Please check the hole in your firewall and try again.",
			statusCode: 200
		},
		502: {
			message: "We weren't able to complete your request. Please try again.",
			statusCode: 502
		},
		default: {
			message: "Something went wrong",
			statusCode: 200
		}
	}
};

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
			req.log.error({ "ERROR": err, gheServerURL }, `Something went wrong`);
			const { message, statusCode } = gheServerUrlErrors.codeOrStatus["default"];
			res.status(statusCode).send({ success: false, error: message });
		}
	} else {
		req.log.error(`The entered URL is not valid. ${gheServerURL} is not a valid url`);
		res.status(200).send({ success: false, error: "The entered URL is not valid." });
	}
};

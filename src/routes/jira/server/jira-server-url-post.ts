import { Request, Response } from "express";
import axios from "axios";
import { GitHubServerApp } from "models/github-server-app";
import { isValidUrl } from "utils/is-valid-url";

interface MessageAndCode {
	error: string;
	message: string;
	statusCode: number;
	type?: string;
}

interface GheServerUrlErrorResponses {
	[key: string | number]: MessageAndCode;
}

interface GheServerUrlErrors {
	codeOrStatus: GheServerUrlErrorResponses
}

export const gheServerUrlErrors: GheServerUrlErrors = {
	codeOrStatus: {
		ENOTFOUND: {
			error: "We couldn't verify this URL",
			message: "Please make sure you've entered the correct URL and check that you've properly configured the hole in your firewall.",
			statusCode: 200,
			type: "FIREWALL_ERROR"
		},
		502: {
			error: "Request failed",
			message: "We weren't able to complete your request. Please try again.",
			statusCode: 502
		},
		default: {
			error: "Something went wrong",
			message: "We ran into a hiccup while verifying your details. Please try again later.",
			statusCode: 200
		}
	}
};

const getGheErrorMessages = (codeOrStatus: number | string) => {
	switch (codeOrStatus) {
		case "ENOTFOUND":
			return gheServerUrlErrors.codeOrStatus["ENOTFOUND"];
		case 502:
			return gheServerUrlErrors.codeOrStatus[502];
		default:
			return gheServerUrlErrors.codeOrStatus["default"];
	}
};

export const JiraServerUrlPost = async (
	req: Request,
	res: Response
): Promise<void> => {
	// update to get installationId from locals
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
			req.log.error({ err, gheServerURL }, `Something went wrong`);
			const { error, message, statusCode, type } = getGheErrorMessages(err.code || err.status);
			res.status(statusCode).send({ success: false, error, message, type });
		}
	} else {
		req.log.error(`The entered URL is not valid. ${gheServerURL} is not a valid url`);
		res.status(200).send({ success: false, error: "Invalid URL", message: "That URL doesn't look right. Please check and try again." });
	}
};

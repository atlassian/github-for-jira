import { Request, Response } from "express";
import axios from "axios";
import { GitHubServerApp } from "models/github-server-app";
import { isValidUrl } from "utils/is-valid-url";

interface MessageAndCode {
	errorCode: string;
	message: string;
	statusCode: number;
}

interface GheServerUrlErrorResponses {
	[key: string | number]: MessageAndCode;
}

interface GheServerUrlErrors {
	codeOrStatus: GheServerUrlErrorResponses;
}

const gheServerUrlErrors: GheServerUrlErrors = {
	codeOrStatus: {
		invalidUrl: {
			errorCode: "GHE_ERROR_1",
			message: "Invalid URL",
			statusCode: 200
		},
		ENOTFOUND: {
			errorCode: "GHE_ERROR_2",
			message: "Request to URL failed",
			statusCode: 200
		},
		502: {
			errorCode: "GHE_ERROR_3",
			message: "Bad gateway",
			statusCode: 502
		},
		default: {
			errorCode: "GHE_ERROR_4",
			message: "Something went wrong",
			statusCode: 200
		}
	}
};

export const getGheErrorMessages = (codeOrStatus: number | string | null) => {
	switch (codeOrStatus) {
		case "invalidUrl":
			return gheServerUrlErrors.codeOrStatus["invalidUrl"];
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
	const { gheServerURL } = req.body;
	const { id: installationId } = res.locals.installation;

	req.log.debug(`Verifying provided GHE server url ${gheServerURL} is a valid URL`);
	const isGheUrlValid = isValidUrl(gheServerURL);

	if (!isGheUrlValid) {
		const { errorCode, message, statusCode } = getGheErrorMessages("invalidUrl");
		res.status(statusCode).send({ success: false, errorCode, message });
		req.log.error(`The entered URL is not valid. ${gheServerURL} is not a valid url`);
	}

	try {
		const gitHubServerApps = await GitHubServerApp.getAllForGitHubBaseUrl(gheServerURL, installationId);

		if (gitHubServerApps?.length) {
			req.log.debug(`GitHub apps found for url: ${gheServerURL}. Redirecting to Jira list apps page.`);
			res.status(200).send({ success: true, moduleKey: "github-list-apps-page" });
			return;
		}
		req.log.debug(`No existing GitHub apps found for url: ${gheServerURL}. Making request to provided url.`);
		await axios.get(gheServerURL);
		res.status(200).send({ success: true, moduleKey: "github-app-creation-page" });
	} catch (err) {
		req.log.error({ err, gheServerURL }, `Something went wrong`);
		const { errorCode, message, statusCode } = getGheErrorMessages(err.code || err.response.status);
		res.status(statusCode).send({ success: false, errorCode, message });
	}
};

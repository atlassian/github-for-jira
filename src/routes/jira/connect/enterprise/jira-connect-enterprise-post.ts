import { Request, Response } from "express";
import axios from "axios";
import { GitHubServerApp } from "models/github-server-app";
import { validateUrl } from "utils/validate-url";
import { statsd } from "config/statsd";
import { metricError } from "config/metric-names";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum } from "interfaces/common";

interface MessageAndCode {
	errorCode: string;
	message: string;
}

interface GheServerUrlErrors {
	[key: string | number]: MessageAndCode;
}

const GHE_ERROR_UNREACHABLE = {
	errorCode: "GHE_ERROR_ENOTFOUND",
	message: "Request to URL failed"
};

const GHE_ERROR_TIMEOUT = {
	errorCode: "GHE_ERROR_CONNECTION_TIMED_OUT",
	message: "Connection timed out"
};

export const gheServerUrlErrors: GheServerUrlErrors = {
	invalidUrl: {
		errorCode: "GHE_ERROR_INVALID_URL",
		message: "Invalid URL"
	},
	ENOTFOUND: GHE_ERROR_UNREACHABLE,
	DEPTH_ZERO_SELF_SIGNED_CERT: GHE_ERROR_UNREACHABLE,
	403: GHE_ERROR_UNREACHABLE,
	502: {
		errorCode: "GHE_SERVER_BAD_GATEWAY",
		message: "Bad gateway"
	},
	ECONNABORTED: GHE_ERROR_TIMEOUT,
	ETIMEDOUT: GHE_ERROR_TIMEOUT
};

export const JiraConnectEnterprisePost = async (
	req: Request,
	res: Response
): Promise<void> => {

	// Must be configurable and re-evaluated on each execution for testing, therefore
	// inside the handler
	const TIMEOUT_PERIOD_MS = parseInt(process.env.JIRA_CONNECT_ENTERPRISE_POST_TIMEOUT_MSEC || "30000");

	const { gheServerURL } = req.body;
	const { id: installationId } = res.locals.installation;

	req.log.debug(`Verifying provided GHE server url ${gheServerURL} is a valid URL`);
	const urlValidationResult = validateUrl(gheServerURL);

	if (!urlValidationResult.isValidUrl) {
		const errorCode = gheServerUrlErrors.invalidUrl.errorCode;
		const message = gheServerUrlErrors.invalidUrl.message;
		res.status(200).send({ success: false, errors: [{ code: errorCode, message, reason: urlValidationResult.reason }] });
		req.log.error(`The entered URL is not valid. ${gheServerURL} is not a valid url`);
		return;
	}

	const jiraHost = res.locals.jiraHost;

	try {
		const gitHubServerApps = await GitHubServerApp.getAllForGitHubBaseUrlAndInstallationId(gheServerURL, installationId);

		if (gitHubServerApps?.length) {
			req.log.debug(`GitHub apps found for url: ${gheServerURL}. Redirecting to Jira list apps page.`);
			res.status(200).send({ success: true, appExists: true });
			return;
		}

		req.log.debug(`No existing GitHub apps found for url: ${gheServerURL}. Making request to provided url.`);

		await axios.get(gheServerURL, { timeout: TIMEOUT_PERIOD_MS });
		res.status(200).send({ success: true, appExists: false });

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.GitHubServerUrlTrackEventName,
			jiraHost: jiraHost
		});
	} catch (err) {
		req.log.error({ err, gheServerURL }, `Something went wrong`);
		const codeOrStatus = err.code || err.response.status;
		const serverError = gheServerUrlErrors[codeOrStatus];
		const errorCode = serverError?.errorCode || codeOrStatus;
		const message = serverError?.message;

		res.status(200).send({ success: false, errors: [{ code: errorCode, message, reason: codeOrStatus }] });
		statsd.increment(metricError.gheServerUrlError, { errorCode, status: err.response?.status });

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.GitHubServerUrlErrorTrackEventName,
			jiraHost,
			errorCode,
			errorMessage: message
		});
	}
};

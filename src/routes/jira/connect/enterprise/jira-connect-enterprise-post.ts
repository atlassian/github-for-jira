import { Request, Response } from "express";
import axios from "axios";
import { GitHubServerApp } from "models/github-server-app";
import { isValidUrl } from "utils/is-valid-url";
import { statsd } from "config/statsd";
import { metricError } from "config/metric-names";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum } from "interfaces/common";
import { envVars } from "config/env";
import HttpsProxyAgent from "https-proxy-agent/dist/agent";
// import HttpProxyAgent from "http-proxy-agent/dist/agent";

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
	default: {
		errorCode: "GHE_ERROR_DEFAULT",
		message: "Something went wrong"
	}
};

export const JiraConnectEnterprisePost = async (
	req: Request,
	res: Response
): Promise<void> => {
	const { gheServerURL } = req.body;
	const { id: installationId } = res.locals.installation;

	req.log.debug(`Verifying provided GHE server url ${gheServerURL} is a valid URL`);
	const isGheUrlValid = isValidUrl(gheServerURL);

	if (!isGheUrlValid) {
		const { errorCode, message } = gheServerUrlErrors.invalidUrl;
		res.status(200).send({ success: false, errors: [{ code: errorCode, message }] });
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
		await axios.get(gheServerURL, {
			// Even though Axios provides the `proxy` option to configure a proxy, this doesn't work and will
			// always cause an HTTP 501 (see https://github.com/axios/axios/issues/3459). The workaround is to
			// create an Http(s)ProxyAgents and set the `proxy` option to false.
			// httpAgent: envVars.PROXY ? new HttpProxyAgent(envVars.PROXY) : undefined,
			httpsAgent: envVars.PROXY ? new HttpsProxyAgent(envVars.PROXY) : undefined,
			proxy: false
		});
		res.status(200).send({ success: true, appExists: false });

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.GitHubServerUrlTrackEventName,
			jiraHost: jiraHost
		});
	} catch (err) {
		req.log.error({ err, gheServerURL }, `Something went wrong`);
		const codeOrStatus = err.code || err.response.status;
		const { errorCode, message } = gheServerUrlErrors[codeOrStatus] || gheServerUrlErrors.default;
		res.status(200).send({ success: false, errors: [{ code: errorCode, message }] });
		statsd.increment(metricError.gheServerUrlError, { errorCode, status: err.response?.status });

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.GitHubServerUrlErrorTrackEventName,
			jiraHost,
			errorCode,
			errorMessage: message
		});
	}
};

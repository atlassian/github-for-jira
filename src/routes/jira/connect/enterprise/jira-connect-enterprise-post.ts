import Logger from "bunyan";
import { Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { validateUrl } from "utils/validate-url";
import { statsd } from "config/statsd";
import { metricError } from "config/metric-names";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { createAnonymousClient } from "utils/get-github-client-config";
import { GithubClientError } from "~/src/github/client/github-client-errors";
import { AxiosError, AxiosResponse } from "axios";
import { canBeUsedAsApiKeyHeader, isUniquelyGitHubServerHeader } from "utils/http-headers";
import { GheConnectConfig, GheConnectConfigTempStorage } from "utils/ghe-connect-config-temp-storage";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";

const GITHUB_CLOUD_HOSTS = ["github.com", "www.github.com"];

enum ErrorResponseCode {
	INVALID_URL = "GHE_ERROR_INVALID_URL",
	CLOUD_HOST = "GHE_ERROR_GITHUB_CLOUD_HOST",
	CANNOT_CONNECT = "GHE_ERROR_CANNOT_CONNECT"
}

const isInteger = (n: string) => {
	return !isNaN(Number(n));
};

const sendErrorMetricAndAnalytics = (jiraHost: string, errorCode: ErrorResponseCode, maybeStatus: string | undefined = undefined) => {
	const errorCodeAndStatusObj: { errorCode: string, status?: string } = { errorCode };
	if (maybeStatus) {
		errorCodeAndStatusObj.status = maybeStatus;
	}
	statsd.increment(metricError.gheServerUrlError, errorCodeAndStatusObj, { jiraHost });

	sendAnalytics(AnalyticsEventTypes.TrackEvent, {
		name: AnalyticsTrackEventsEnum.GitHubServerUrlErrorTrackEventName,
		source: AnalyticsTrackSource.CreateBranch,
		jiraHost,
		...errorCodeAndStatusObj
	});
};

const isResponseFromGhe = (logger: Logger, response?: AxiosResponse) => {
	if (!response) {
		logger.info("No response, cannot conclude if coming from GHE or not");
		return false;
	}
	return !!Object.keys(response.headers).find(isUniquelyGitHubServerHeader) ||
		response.headers["server"] === "GitHub.com";
};

const saveTempConfigAndRespond200 = async (res: Response, gheConnectConfig: GheConnectConfig, installationId: number) => {
	const connectConfigUuid = await (new GheConnectConfigTempStorage()).store(gheConnectConfig, installationId);
	res.status(200).send({ success: true, connectConfigUuid, appExists: false });
};

const useExistingConfigAndRespond200 = async (res: Response, githubServerApp: GitHubServerApp) => {
	res.status(200).send({ success: true, connectConfigUuid: githubServerApp.uuid, appExists: true });
};

const validateApiKeyInputsAndReturnErrorIfAny = (apiKeyHeader: string | undefined, apiKeyValue: string | undefined) => {
	if (apiKeyHeader) {
		let error = "";
		if (!apiKeyValue) {
			error = "apiKeyHeader was provided but apiKeyValue was empty";
		}
		if (!canBeUsedAsApiKeyHeader(apiKeyHeader)) {
			error = "Provided apiKeyHeader cannot be used as API key header";
		}
		if (apiKeyHeader.length > 1024) {
			error = "apiKeyHeader max length is 1024";
		}
		if (apiKeyValue && apiKeyValue.length > 8096) {
			error = "apiKeyValue max length is 8096";
		}
		return error;
	}
	return undefined;
};

export const JiraConnectEnterprisePost = async (
	req: Request,
	res: Response
): Promise<void> => {

	// Must be configurable and re-evaluated on each execution for testing, therefore
	// inside the handler
	const TIMEOUT_PERIOD_MS = parseInt(process.env.JIRA_CONNECT_ENTERPRISE_POST_TIMEOUT_MSEC || "30000");

	const gheServerURL = req.body.gheServerURL?.trim();
	const apiKeyHeader = req.body.apiKeyHeader?.trim();
	const apiKeyValue = req.body.apiKeyValue?.trim();

	const { id: installationId } = res.locals.installation;

	const jiraHost = res.locals.jiraHost;

	req.log.debug(`Verifying provided GHE server url ${gheServerURL} is a valid URL`);
	const urlValidationResult = validateUrl(gheServerURL);

	if (!urlValidationResult.isValidUrl) {
		res.status(200).send({
			success: false,
			errors: [{ code: ErrorResponseCode.INVALID_URL, reason: urlValidationResult.reason }]
		});
		req.log.info(`The entered URL is not valid. ${gheServerURL} is not a valid url`);
		sendErrorMetricAndAnalytics(jiraHost, ErrorResponseCode.INVALID_URL);
		return;
	}

	const maybeApiKeyInputsError = validateApiKeyInputsAndReturnErrorIfAny(apiKeyHeader, apiKeyValue);
	if (maybeApiKeyInputsError) {
		req.log.warn({ apiKeyHeader, apiKeyValue }, maybeApiKeyInputsError);
		res.sendStatus(400); // Let's not bother too much: the same validation happened in frontend
		return;
	}

	if (GITHUB_CLOUD_HOSTS.includes(new URL(gheServerURL).hostname)) {
		res.status(200).send({ success: false, errors: [ { code: ErrorResponseCode.CLOUD_HOST } ] });
		req.log.info("The entered URL is GitHub cloud site, return error");
		sendErrorMetricAndAnalytics(jiraHost, ErrorResponseCode.CLOUD_HOST);
		return;
	}

	const gitHubServerApps = await GitHubServerApp.getAllForGitHubBaseUrlAndInstallationId(gheServerURL, installationId);

	const gitHubConnectConfig: GheConnectConfig = {
		serverUrl: gheServerURL,
		apiKeyHeaderName: apiKeyHeader || null,
		encryptedApiKeyValue: apiKeyValue
			? await EncryptionClient.encrypt(EncryptionSecretKeyEnum.GITHUB_SERVER_APP, apiKeyValue, { jiraHost })
			: null
	};

	if (gitHubServerApps?.length) {
		req.log.debug(`GitHub apps found for url: ${gheServerURL}. Redirecting to Jira list apps page.`);
		await useExistingConfigAndRespond200(res, gitHubServerApps[0]);
		return;
	}

	req.log.debug(`No existing GitHub apps found for url: ${gheServerURL}. Making request to provided url.`);

	try {
		const client = await createAnonymousClient(gheServerURL, jiraHost, { trigger: "jira-connect-enterprise-post" }, req.log);

		// We want to simulate a production-like call, that's why call real endpoint with
		// some fake Auth header
		const response = await client.getPage(TIMEOUT_PERIOD_MS, "/api/v3/rate_limit", {
			authorization: "Bearer ghs_fake0fake1fake2w1xVgkCPL2vk8L52AeEkv",
			... (
				apiKeyHeader
					? { [apiKeyHeader]: apiKeyValue }
					: { }
			)
		});

		if (!isResponseFromGhe(req.log, response)) {
			req.log.warn("Received OK response, but not GHE server");
			res.status(200).send({
				success: false, errors: [{
					code: ErrorResponseCode.CANNOT_CONNECT,
					reason: "Received OK, but the host is not GitHub Enterprise server"
				}]
			});
			sendErrorMetricAndAnalytics(jiraHost, ErrorResponseCode.CANNOT_CONNECT, "" + response.status);
			return;
		}

		await saveTempConfigAndRespond200(res, gitHubConnectConfig, installationId);

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.GitHubServerUrlTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise,
			jiraHost: jiraHost
		});
	} catch (err) {
		const axiosError: AxiosError = (err instanceof GithubClientError) ? err.cause : err;

		req.log.info({ err }, `Error from GHE... but did we hit GHE?!`);
		if (isResponseFromGhe(req.log, axiosError.response)) {
			req.log.info({ err }, "Server is reachable, but responded with a status different from 200/202");
			await saveTempConfigAndRespond200(res, gitHubConnectConfig, installationId);
			sendAnalytics(AnalyticsEventTypes.TrackEvent, {
				name: AnalyticsTrackEventsEnum.GitHubServerUrlTrackEventName,
				source: AnalyticsTrackSource.GitHubEnterprise,
				jiraHost: jiraHost
			});
			return;
		}

		const codeOrStatus = "" + (axiosError.code || axiosError.response?.status);
		req.log.warn({ err, gheServerURL }, `Couldn't access GHE host`);

		const reasons = [err.message];
		reasons.push(axiosError.message || "");

		reasons.push(
			isInteger(codeOrStatus)
				? `Received ${codeOrStatus} response.`
				: codeOrStatus
		);

		res.status(200).send({
			success: false, errors: [{
				code: ErrorResponseCode.CANNOT_CONNECT,
				reason: reasons
					.filter(item => !!item)
					.map(reason =>
						reason.trim().replace(/\.*$/, ""))
					.join(". ")
			}]
		});
		sendErrorMetricAndAnalytics(jiraHost, ErrorResponseCode.CANNOT_CONNECT, codeOrStatus);
	}
};

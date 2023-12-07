/* eslint-disable */
import { envVars } from "config/env";
import axios from "axios";
import { JiraAuthor } from "interfaces/jira";
import { isEmpty, isString, pickBy, uniq } from "lodash";
import { GitHubServerApp } from "models/github-server-app";
import { Subscription } from "models/subscription";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { isConnected } from "utils/is-connected";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { Installation } from "models/installation";
import Logger from "bunyan";
import { JiraClient } from "models/jira-client";
import { RestApiError } from "config/errors";

export const getJiraAppUrl = (jiraHost: string): string =>
	jiraHost?.length ? `${jiraHost}/plugins/servlet/ac/${envVars.APP_KEY}/github-post-install-page` : "";

export const getJiraMarketplaceUrl = (jiraHost: string): string =>
	jiraHost?.length ? `${jiraHost}/jira/marketplace/discover/app/com.github.integration.production` : "";

export const jiraSiteExists = async (jiraHost: string): Promise<boolean> => {
	if (!jiraHost?.length) {
		return false;
	}

	// Check that the entered domain is valid by making a request to the status endpoint
	return axios(`${jiraHost}/status`, {
		method: "GET",
		headers: {
			"content-type": "application/json"
		}
	})
		.then(
			() => true,
			() => false
		);
};

export const getJiraAuthor = (...authors: (Author | undefined)[]): JiraAuthor => {
	const author = Object.assign({}, ...authors);
	return author.login || author.name ? pickBy({
		avatar: author.avatar_url || author.avatarUrl || (author.login ? `https://github.com/users/${author.login}.png` : undefined),
		name: author.name || author.user?.name || author.login || author.email?.match(/^(.*)@/)?.pop() || "unknown",
		email: author.email || `${author.login}@noreply.user.github.com`,
		url: author.html_url || author.html_url || author.user?.url  || author.url || (author.login ? `https://github.com/users/${author.login}` : undefined)
	}) as JiraAuthor : {
		avatar: "https://github.com/ghost.png",
		name: "Deleted User",
		email: "deleted@noreply.user.github.com",
		url: "https://github.com/ghost"
	};
};

export const limitCommitMessage = (message = "", length = 1024): string => {
	return message.substring(0, length);
};

interface Author {
	// Github REST API always returns `avatar_url` while the GraphQL API returns `avatarUrl`
	// We're including both just in case
	avatar_url?: string;
	avatarUrl?: string;
	name?: string;
	login?: string;
	email?: string;
	url?: string;
	html_url?: string;
	user?: {
		url?: string;
	};
}

/**
 *  Based on the JIRA Ticket parser extended regex: ^\p{L}[\p{L}\p{Digit}_]{1,255}-\p{Digit}{1,255}$ (^|[^\p{L}\p{Nd}]) means that it must be at the start of the string
 *  or be a non unicode-digit character (separator like space, new line, or special character like [) [\p{L}][\p{L}\p{Nd}_]{1,255} means that the id must start with a unicode letter,
 *  then must be at least one more unicode-digit character up to 256 length to prefix the ID -\p{Nd}{1,255} means that it must be separated by a dash,
 *  then at least 1 number character up to 256 length
 */
const jiraIssueRegex = (): RegExp => {
	return /(^|[^A-Z\d])([A-Z][A-Z\d]{1,255}-[1-9]\d{0,255})(?=$|[^A-Z\d])/giu;
};

/**
 * Same as the `jiraIssueRegex`,
 * but this Regex captures only those issue keys that are surrounded by square brackets
 * This regex is used when adding links to Jira issues in GitHub PR issue/descriptions.
 */
export const jiraIssueInSquareBracketsRegex = (): RegExp => {
	return /(^|[^A-Z\d])\[([A-Z][A-Z\d]{1,255}-[1-9]\d{0,255})\]/giu;
};

/**
 * Parses strings for Jira issue keys for commit messages,
 * branches, and pull requests.
 *
 * Accepted patterns:
 *      - JRA-123 (all uppercase)
 *      - jRA-123 (some uppercase, some lowercase - any order)
 *      - jra-123 (all lowercase - any order)
 *      - J2-123 (first part of key alphanumeric)
 *      - [JRA-123] (keys inside square brackets)
 *      - (JRA-123) (keys inside parenthesis)
 *      - #JRA-123 (keys prefixed with hash)
 *
 * Not accepted:
 *      - 22-123 (issue key starts with a number)
 *      - JRA 123 (missing hyphen from key)
 */
export const jiraIssueKeyParser = (str: string): string[] => {
	// if not a string or string has no length, return empty array.
	if (!isString(str) || !str.length) {
		return [];
	}

	// Parse all issue keys from string then we UPPERCASE the matched string and remove duplicate issue keys
	return uniq(Array.from(str.matchAll(jiraIssueRegex()), m => m[2].toUpperCase()));
};

export const hasJiraIssueKey = (str: string): boolean => !isEmpty(jiraIssueKeyParser(str));

export const isGitHubCloudApp = async (gitHubAppId: number | undefined): Promise<boolean> => {
	return !(gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(gitHubAppId));
};

const deleteSecurityWorkspaceLinkAndVulns = async (
	installation: Installation,
	subscription: Subscription,
	logger: Logger,
) => {

	try {
		logger.info("Fetching info about GitHub installation");

		const jiraClient = await JiraClient.getNewClient(installation, logger);
		await Promise.allSettled([
			jiraClient.deleteWorkspace(subscription.id),
			jiraClient.deleteVulnerabilities(subscription.id)
		]);
	} catch (err: unknown) {
		logger.warn({ err }, "Failed to delete security workspace or vulnerabilities from Jira");
	}
};

export const removeSubscription = async (
	installation: Installation,
	ghInstallationId: number | undefined,
	gitHubAppId: number | undefined,
	logger: Logger,
	subscriptionId: number | undefined
) => {
	const jiraHost = installation.jiraHost;
	// TODO: Remove ghInstallationId and replace it by subscriptionId
	const subscription = subscriptionId ? await Subscription.findByPk(subscriptionId) :
		await Subscription.getSingleInstallation(
			jiraHost,
			ghInstallationId as number,
			gitHubAppId
		);
	if (!subscription) {
		logger.warn("Cannot find subscription");
		throw new RestApiError(404, "RESOURCE_NOT_FOUND", "Can not find subscription");
	}

	const gitHubInstallationId = subscription.gitHubInstallationId;

	const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, gitHubAppId, logger);
	if (jiraClient === undefined) {
		throw new RestApiError(500, "UNKNOWN", "jiraClient is undefined");
	}
	await jiraClient.devinfo.installation.delete(gitHubInstallationId);
	if (await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraHost)) {
		await deleteSecurityWorkspaceLinkAndVulns(installation, subscription, logger);
		logger.info({ subscriptionId: subscription.id }, "Deleted security workspace and vulnerabilities");
	}
	await subscription.destroy();

	if (!(await isConnected(jiraHost))) {
		await saveConfiguredAppProperties(jiraHost, logger, false);
	}

	await sendAnalytics(jiraHost, AnalyticsEventTypes.TrackEvent, {
		action: AnalyticsTrackEventsEnum.DisconnectToOrgTrackEventName,
		actionSubject: AnalyticsTrackEventsEnum.DisconnectToOrgTrackEventName,
		source: !gitHubAppId ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise
	}, {
		gitHubProduct: getCloudOrServerFromGitHubAppId(gitHubAppId),
		spa: !!subscriptionId
	});

	return true;
}


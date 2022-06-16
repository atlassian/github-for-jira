/* eslint-disable */
import { envVars } from "config/env";
import axios from "axios";
import { JiraAuthor } from "interfaces/jira";
import { isEmpty, isString, pickBy, uniq } from "lodash";
import { booleanFlag, BooleanFlags, onFlagChange } from "config/feature-flags";
import { Installation } from "models/installation";
import { GitHubServerApp } from "models/github-server-app";

export const getJiraAppUrl = (jiraHost: string): string =>
	jiraHost?.length ? `${jiraHost}/plugins/servlet/ac/com.github.integration.${envVars.INSTANCE_NAME}/github-post-install-page` : "";

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
		url: author.html_url || author.url || author.user?.url || (author.login ? `https://github.com/users/${author.login}` : undefined)
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

let regexFixFeature = false;
onFlagChange(BooleanFlags.REGEX_FIX, async () => {
	regexFixFeature = await booleanFlag(BooleanFlags.REGEX_FIX, false);
});
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
	if (!isString(str) || !str.length){
		return [];
	}

	// Based on the JIRA Ticket parser extended regex: ^\p{L}[\p{L}\p{Digit}_]{1,255}-\p{Digit}{1,255}$
	// (^|[^\p{L}\p{Nd}]) means that it must be at the start of the string or be a non unicode-digit character (separator like space, new line, or special character like [)
	// [\p{L}][\p{L}\p{Nd}_]{1,255} means that the id must start with a unicode letter, then must be at least one more unicode-digit character up to 256 length to prefix the ID
	// -\p{Nd}{1,255} means that it must be separated by a dash, then at least 1 number character up to 256 length
	const regex = regexFixFeature ?
		// Old regex which was working before trying to update it to the the "correct" one
		/(^|[^A-Z\d])([A-Z][A-Z\d]+-[1-9]\d*)/giu :
		// Regex given to us by sayans
		/(^|[^\p{L}\p{Nd}])([\p{L}][\p{L}\p{Nd}_]{1,255}-\p{Nd}{1,255})/giu;

	// Parse all issue keys from string then we UPPERCASE the matched string and remove duplicate issue keys
	return uniq(Array.from(str.matchAll(regex), m => m[2].toUpperCase()));
};

export const hasJiraIssueKey = (str: string): boolean => !isEmpty(jiraIssueKeyParser(str));

export const isGitHubCloudApp = async (jiraHost: string): Promise<boolean>=> {
	let isGitHubCloud = true;

	/* 3 possible scenarios while we have the feature flag
	*		- FF is set to false: isGitHubCloud default to true
	* 	- FF is true but there is no gitHubAppId in the Installations table or no corresponding entry in the GitHubServerApps table - isGitHubCloud is true
	* 	- FF is true and there is a gitHubAppId in the Installations table and an entry in the GitHubServerApps table - isGitHubCloud is false
	*/
	if (await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)) {
		const installation = await Installation.getForHost(jiraHost);
		const gitHubAppId = installation?.githubAppId;

		if (gitHubAppId) {
			isGitHubCloud = !await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);
		}
	}

	return isGitHubCloud;
}

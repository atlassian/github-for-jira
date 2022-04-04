import { envVars }  from "config/env";
import axios from "axios";
import { JiraAuthor } from "interfaces/jira";
import { isString, pickBy } from "lodash";

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
 * Parses strings for Jira issue keys for commit messages,
 * branches, and pull requests.
 *
 * Accepted patterns:
 *      - JRA-123 (all uppercase)
 *      - jRA-123 (some uppercase, some lowercase - any order)
 *      - jra-123 (all lowercase - any order)
 *      - J2-123 (first part of key alphanumeric)
 *      - [JRA-123] (keys inside square brackets)
 *      - (JRA-123) (keys inside square brackets)
 *      - #JRA-123 (keys prefixed with hash)
 *
 * Not accepted:
 *      - 22-123 (issue key starts with a number)
 *      - JRA 123 (missing hyphen from key)
 */

export const jiraIssueKeyParser = (str: string): string[] => {
	if (!isString(str) || !str.length) return [];

	const issueKeyRegex = /[A-Za-z0-9]+-[0-9]+/g;
	const matches = str.match(issueKeyRegex);
	const isNumeric = /[0-9]+/g;

	if (!matches) {
		return [];
	}

	return matches
		// Remove any keys that lead with a numeric value
		.filter((issue) => !issue.charAt(0).match(isNumeric))
		// Remove any keys that have a single char
		.filter((issue) => !issue.charAt(1).match("-"))
		// Convert to uppercase so keys can be matched to Jira issues
		.map((issueKey) => issueKey.toUpperCase()) || [];
};

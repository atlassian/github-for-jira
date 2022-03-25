import { envVars }  from "config/env";
import axios from "axios";
import { JiraAuthor } from "interfaces/jira";
import { pickBy } from "lodash";

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


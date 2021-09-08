import { JiraAuthor } from "../interfaces/jira";

export const getJiraAuthor = (author?: Author): JiraAuthor => author ? {
	avatar: author.avatar_url || author.avatarUrl || `https://github.com/${author.login}.png`,
	name: author.name || author.login || "unknown",
	email: author.email || `${author.login || "unknown"}@noreply.user.github.com`,
	url: author.url || author.html_url || author.user?.url || `https://github.com/${author.login}`
} : {
	avatar: "https://github.com/ghost.png",
	name: "Deleted User",
	email: "deleted@noreply.user.github.com",
	url: "https://github.com/ghost"
};

interface Author {
	// Github REST API always returns `avatar_url` while the GraphQL API returns `avatarUrl`
	// We're including both just in case
	avatar_url?: string;
	avatarUrl?: string;
	name?: string;
	login: string;
	email?: string;
	url?: string;
	html_url?: string;
	user?: {
		url?: string;
	};
}

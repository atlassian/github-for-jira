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

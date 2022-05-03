import { Repository } from "models/subscription";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getRepositorySummary = (repo: any): Repository => ({
	id: repo.id,
	name: repo.name,
	full_name: repo.full_name,
	owner: { login: repo.owner.login },
	html_url: repo.html_url,
	updated_at: repo.updated_at
});

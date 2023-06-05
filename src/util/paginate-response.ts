import { Workspace } from "../routes/jira/workspaces/jira-workspaces-get";

export const paginatedResponse = (page: number, limit: number, payload: Workspace[]) => {
	const startIndex = (page - 1) * limit;
	const endIndex = page * limit;
	return payload.slice(startIndex, endIndex);
};

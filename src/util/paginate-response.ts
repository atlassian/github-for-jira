import { Workspace } from "../routes/jira/workspaces/jira-workspaces-get";
import { RepoSyncState } from "models/reposyncstate";

export const paginatedRepositories = (page: number, limit: number, payload: Workspace[] | RepoSyncState[]) => {
	const startIndex = (page - 1) * limit;
	const endIndex = page * limit;
	return payload.slice(startIndex, endIndex);
};

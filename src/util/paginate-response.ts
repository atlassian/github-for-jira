import { Workspace } from "../routes/jira/workspaces/jira-workspaces-get";
import { WorkspaceRepo } from "routes/jira/workspaces/repositories/jira-workspaces-repositories-get";

export const paginatedResponse = (page: number, limit: number, payload: Workspace[] | WorkspaceRepo[]) => {
	const startIndex = (page - 1) * limit;
	const endIndex = page * limit;
	return payload.slice(startIndex, endIndex);
};

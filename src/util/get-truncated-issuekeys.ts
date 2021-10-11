import { ISSUE_KEY_API_LIMIT } from "../jira/client";

export const getTruncatedIssuekeys = (issueKeys?:string[]) => {
	return issueKeys?.slice(ISSUE_KEY_API_LIMIT) || [];
}

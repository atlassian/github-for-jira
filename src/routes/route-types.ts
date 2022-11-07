import { Installation } from "../models/installation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GitHubAppVerifiedLocals = {
	gitHubAppConfig: GitHubAppConfig,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JiraVerifiedLocals = {
	jiraHost: string,
	installation: Installation,
};

export type JiraAndGitHubVerifiedLocals = GitHubAppVerifiedLocals & JiraVerifiedLocals;

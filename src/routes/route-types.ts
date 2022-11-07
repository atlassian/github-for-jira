import { Installation } from "../models/installation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GitHubAppVerifiedLocals = Record<string, any> & {
	gitHubAppConfig: GitHubAppConfig
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JiraVerifiedLocals = Record<string, any> & {
	jiraHost: string,
	installation: Installation,
};

export type JiraAndGitHubVerifiedLocals = GitHubAppVerifiedLocals & JiraVerifiedLocals;

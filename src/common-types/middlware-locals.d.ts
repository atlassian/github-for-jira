
export type JiraHostVerifiedLocals = {
	jiraHost: string,
};

export type JiraJwtVerifiedLocals = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	installation: any //TODO: This is a hack, fix it with full definition.
};

export type GitHubAppVerifiedLocals = {
	gitHubAppConfig: GitHubAppConfig,
};

export type GitHubUserTokenVerifiedLocals = {
	gitHubToken: string;
};

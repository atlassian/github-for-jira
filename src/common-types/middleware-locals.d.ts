type CommonResponseLocals = {
	nonce: string
}

type JiraHostVerifiedLocals = CommonResponseLocals  & {
	jiraHost: string,
};

type JiraJwtVerifiedLocals = CommonResponseLocals & {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	installation: any //TODO: This is a hack, fix it with full definition.
};

type GitHubAppVerifiedLocals = CommonResponseLocals & {
	gitHubAppConfig: GitHubAppConfig,
};

type GitHubUserTokenVerifiedLocals = CommonResponseLocals & {
	githubToken: string;
};

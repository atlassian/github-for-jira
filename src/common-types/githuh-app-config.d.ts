type GitHubAppConfig = {
	//Either PK in GitHubServerApps table or undefined for cloud
	gitHubAppId: number | undefined,
	//Either uuid column in GitHubServerApps table or undefined for cloud
	uuid: string | undefined,
	appId: number,
	clientId: string,
	gitHubBaseUrl: string,
	gitHubApiUrl: string,
}

type GitHubAppConfigWithSecrets = GitHubAppConfig & {
	getGitHubClientSecret: () => Promise<string>,
	getWebhookSecret: () => Promise<string>,
	getPrivateKey: () => Promise<string>
}

/*
 * Types for both Cloud and Enterprise server product
 */
export type GitHubAppConfigPayload = {
	/*
	 * undefined for cloud, real value for GHE
	 * Otherwise, lost of duplicates values in msg body for cloud (majority traffic)
	 */
	gitHubAppConfig?: {
		appId: number,
		clientId: string,
		gitHubBaseUrl: string,
		uuid: string,
		gitHubAppId: string,
		gitHubClientSecret: string,
		webhookSecret: string,
		privateKey: string
	}
}

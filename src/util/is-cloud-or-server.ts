export const isCloudOrServerSubscription = (gitHubAppId: number | undefined) => gitHubAppId ? "server" : "cloud";

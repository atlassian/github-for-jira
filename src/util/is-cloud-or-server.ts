export const isCloudOrServerSubscription = (gitHubAppId: number | null) => gitHubAppId ? "server" : "cloud";

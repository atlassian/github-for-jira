export const getCloudOrServerFromGitHubAppId = (gitHubAppId: number | undefined) => gitHubAppId ? "server" : "cloud";
export const getCloudOrServerFromHost = (host: string) => host === "api.github.com" ? "cloud" : "server";

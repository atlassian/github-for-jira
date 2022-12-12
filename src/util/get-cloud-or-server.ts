import { GITHUB_CLOUD_API_BASEURL } from "utils/get-github-client-config";

export const getCloudOrServerFromGitHubAppId = (gitHubAppId: number | undefined) => gitHubAppId ? "server" : "cloud";
export const getCloudOrServerFromHost = (host: string) => GITHUB_CLOUD_API_BASEURL.includes(host) ? "cloud" : "server";

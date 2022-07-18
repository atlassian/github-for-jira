import { GITHUB_CLOUD_API_BASEURL } from "utils/get-github-client-config";

export const isCloudOrServerSubscription = (gitHubAppId: number | undefined) => gitHubAppId ? "server" : "cloud";
export const isCloudOrServerHost = (host: string) => host === GITHUB_CLOUD_API_BASEURL ? "cloud" : "server";

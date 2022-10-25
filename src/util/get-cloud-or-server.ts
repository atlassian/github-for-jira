import { GITHUB_CLOUD_API_BASEURL } from "utils/get-github-client-config";

export enum GithubProductEnum {
	CLOUD = "cloud",
	SERVER = "server",
}

export const getCloudOrServerFromGitHubAppId = (gitHubAppId: number | undefined): GithubProductEnum => gitHubAppId ? GithubProductEnum.SERVER : GithubProductEnum.CLOUD;
export const getCloudOrServerFromHost = (host: string): GithubProductEnum => GITHUB_CLOUD_API_BASEURL.includes(host) ? GithubProductEnum.CLOUD : GithubProductEnum.SERVER;

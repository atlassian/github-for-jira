import { Installation } from "~/src/models/installation";

export interface BaseLocals extends Record<string, object | string | number | undefined> {
	gitHubAppConfig: {
		gitHubAppId: number | undefined;
		appId: string;
		uuid: string | undefined;
		hostname: string;
		clientId: string;
	};
	installation: Installation;
	jiraHost: string;
	githubToken: string;
	gitHubAppId: number;
	accountId?: string;
}
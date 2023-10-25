import { Installation } from "~/src/models/installation";

export interface BaseLocals extends Record<string, any> {
	installation: Installation;
	jiraHost: string;
	githubToken: string;
	gitHubAppId: number;
	accountId?: string;
}
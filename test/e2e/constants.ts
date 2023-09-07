import { e2eEnvVars } from "test/e2e/env-e2e";
import { v4 as uuid } from "uuid";

export const STATE_PATH = "./test/e2e/test-results/states";
export const SCREENSHOT_PATH = "./test/e2e/test-results/screenshots";

export const createProjectId = () => `P${uuid().substring(0, 5)}`.toUpperCase();
// Project ID created for each e2e test run
const projectId = (): string => {
	if (!process.env.PROJECT_KEY) {
		process.env.PROJECT_KEY = createProjectId();
	}
	return process.env.PROJECT_KEY;
};

export const testData: TestData = {
	stateDirectoryPath: STATE_PATH,
	state: `${STATE_PATH}/default.json`,
	appUrl: e2eEnvVars.APP_URL,
	projectId,
	jira: {
		urls: {
			base: e2eEnvVars.ATLASSIAN_URL,
			login: `${e2eEnvVars.ATLASSIAN_URL}/login`,
			auth: `https://id.atlassian.com/login`,
			logout: `${e2eEnvVars.ATLASSIAN_URL}/logout`,
			dashboard: `${e2eEnvVars.ATLASSIAN_URL}/jira/dashboards`,
			yourWork: `${e2eEnvVars.ATLASSIAN_URL}/jira/your-work`,
			manageApps: `${e2eEnvVars.ATLASSIAN_URL}/plugins/servlet/upm`,
			connectJson: `${e2eEnvVars.APP_URL}/jira/atlassian-connect.json`,
			appMainPage: `${e2eEnvVars.APP_URL}/plugins/servlet/ac/${e2eEnvVars.APP_KEY}/gh-addon-admin`,
			projects: `${e2eEnvVars.ATLASSIAN_URL}/jira/projects`,
			project: (id?: string) => `${e2eEnvVars.ATLASSIAN_URL}/browse/${id || projectId()}`,
			projectDetails: (id?: string) => `${e2eEnvVars.ATLASSIAN_URL}/jira/software/projects/${id || projectId()}/settings/details`,
			browse: (id: string) => `${e2eEnvVars.ATLASSIAN_URL}/browse/${id}`
		},
		roles: {
			admin: {
				username: e2eEnvVars.JIRA_ADMIN_USERNAME,
				password: e2eEnvVars.JIRA_ADMIN_PASSWORD,
				state: `${STATE_PATH}/jira-admin.json`
			}
		}
	},
	github: {
		urls: {
			base: e2eEnvVars.GITHUB_URL,
			login: `${e2eEnvVars.GITHUB_URL}/login`,
			logout: `${e2eEnvVars.GITHUB_URL}/logout`,
			appSettings: `${e2eEnvVars.GITHUB_URL}/settings/apps/${e2eEnvVars.APP_NAME}`,
			apps: `${e2eEnvVars.GITHUB_URL}/user/settings/apps`
		},
		roles: {
			admin: {
				username: e2eEnvVars.GITHUB_USERNAME,
				password: e2eEnvVars.GITHUB_PASSWORD
				// storage: `${STATE_PATH}/github-admin.json`
			}
		}
	}
};

export interface TestData {
	stateDirectoryPath: string;
	state: string;
	appUrl: string;
	projectId: () => string;
	jira: TestDataEntry<JiraTestDataURLs, JiraTestDataRoles>;
	github: TestDataEntry<GithubTestDataURLs>;
}

export interface TestDataEntry<U extends TestDataURLs = TestDataURLs, R extends TestDataRoles = TestDataRoles> {
	urls: U;
	roles: R;
}

export interface TestDataURLs {
	base: string;
	login: string;
	logout: string;
}

export interface JiraTestDataURLs extends TestDataURLs {
	yourWork: string;
	dashboard: string;
	auth: string;
	manageApps: string;
	connectJson: string;
	appMainPage: string;
	projects: string;
	project: (id?: string) => string;
	projectDetails: (id?: string) => string;
	browse: (id: string) => string;
}

export interface GithubTestDataURLs extends TestDataURLs {
	appSettings: string;
	apps: string;
}

export interface TestDataRoles {
	admin: TestDataRole;
}

export type GithubTestDataRoles = TestDataRoles;
export type JiraTestDataRoles = TestDataRoles;

export interface TestDataRole {
	username: string;
	password: string;
	state?: string;
}

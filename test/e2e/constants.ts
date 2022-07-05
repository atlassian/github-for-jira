import { EnvVars, envVars } from "config/env";

interface TestVars extends EnvVars {
	JIRA_USERNAME: string;
	JIRA_PASSWORD: string;
	GITHUB_URL: string;
	GITHUB_USERNAME: string;
	GITHUB_PASSWORD: string;
}

const testVars = envVars as TestVars;

export const testData: TestData = {
	jira: {
		urls: {
			base: testVars.ATLASSIAN_URL,
			login: `${testVars.ATLASSIAN_URL}/login`,
			logout: `${testVars.ATLASSIAN_URL}/logout`,
			dashboard: `${testVars.ATLASSIAN_URL}/jira/your-work`,
			manageApps: `${testVars.ATLASSIAN_URL}/plugins/servlet/upm`,
			connectJson: `${testVars.ATLASSIAN_URL}/jira/atlassian-connect.json`
		},
		roles: {
			admin: {
				username: testVars.JIRA_USERNAME,
				password: testVars.JIRA_PASSWORD,
				storage: "./test/e2e/state/jira-admin.json"
			}
		}
	},
	github: {
		urls: {
			base: testVars.GITHUB_URL,
			login: `${testVars.GITHUB_URL}/login`,
			logout: `${testVars.GITHUB_URL}/logout`
		},
		roles: {
			admin: {
				username: testVars.GITHUB_USERNAME,
				password: testVars.GITHUB_PASSWORD,
				storage: "./test/e2e/state/github-admin.json"
			}
		}
	}
};

export interface TestData {
	jira: TestDataEntry<JiraTestDataURLs, JiraTestDataRoles>;
	github: TestDataEntry;
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
	dashboard: string;
	manageApps: string;
	connectJson: string;
}

export interface TestDataRoles {
	admin: TestDataRole;
}

export type GithubTestDataRoles = TestDataRoles;
export type JiraTestDataRoles = TestDataRoles;

export interface TestDataRole {
	username: string;
	password: string;
	storage?: string;
}

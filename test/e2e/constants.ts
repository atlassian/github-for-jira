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
			dashboard: `${testVars.ATLASSIAN_URL}/jira/your-work`
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
	jira: TestDataEntry<JiraTestDataURLs>;
	github: TestDataEntry;
}

export interface TestDataEntry<U = TestDataURLs> {
	urls: U;
	roles: TestDataRoles;
}

export interface TestDataURLs {
	base: string;
	login: string;
	logout: string;
}

export interface JiraTestDataURLs extends TestDataURLs {
	dashboard: string;
}

interface TestDataRoles {
	admin: TestDataRole;
	[key: string]: TestDataRole;
}

export interface TestDataRole {
	username: string;
	password: string;
	storage?: string;
}

export type LoginData<U = TestDataURLs> = TestDataRole & U;

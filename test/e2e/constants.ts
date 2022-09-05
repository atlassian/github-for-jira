import { EnvVars, envVars } from "config/env";
import path from "path";
import { config } from "dotenv";

interface TestVars extends EnvVars {
	JIRA_ADMIN_USERNAME: string;
	JIRA_ADMIN_PASSWORD: string;
	GITHUB_URL: string;
	GITHUB_USERNAME: string;
	GITHUB_PASSWORD: string;
}

const requiredEnvVars = [
	"JIRA_ADMIN_USERNAME",
	"JIRA_ADMIN_PASSWORD",
	"GITHUB_URL",
	"GITHUB_USERNAME",
	"GITHUB_PASSWORD"
];

// Ignore errors if the file is missing
const e2eVars = config({ path: path.resolve(process.cwd(), ".env.e2e") });

const testVars = {
	...process.env,
	...envVars,
	...e2eVars.parsed
} as TestVars;

// Check to see if all required environment variables are set
const missingVars = requiredEnvVars.filter(key => testVars[key] === undefined);
if (missingVars.length) {
	throw new Error(`Missing required E2E Environment Variables: ${missingVars.join(", ")}`);
}

export const testData: TestData = {
	jira: {
		urls: {
			base: testVars.ATLASSIAN_URL,
			login: `${testVars.ATLASSIAN_URL}/login`,
			logout: `${testVars.ATLASSIAN_URL}/logout`,
			dashboard: `${testVars.ATLASSIAN_URL}/jira/dashboards`,
			yourWork: `${testVars.ATLASSIAN_URL}/jira/your-work`,
			manageApps: `${testVars.ATLASSIAN_URL}/plugins/servlet/upm`,
			connectJson: `${testVars.APP_URL}/jira/atlassian-connect.json`
		},
		roles: {
			admin: {
				username: testVars.JIRA_ADMIN_USERNAME,
				password: testVars.JIRA_ADMIN_PASSWORD,
				storage: "./test/e2e/state/jira-admin.json"
			}
		}
	},
	github: {
		urls: {
			base: testVars.GITHUB_URL,
			login: `${testVars.GITHUB_URL}/login`,
			logout: `${testVars.GITHUB_URL}/logout`,
			apps: `${testVars.GITHUB_URL}/user/settings/apps`
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
	manageApps: string;
	connectJson: string;
}

export interface GithubTestDataURLs extends TestDataURLs {
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
	storage?: string;
}

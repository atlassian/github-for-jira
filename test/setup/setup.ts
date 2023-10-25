import nock, { cleanAll  as nockCleanAll } from "nock";
import { envVars } from "config/env";
import "./matchers/nock";
import "./matchers/to-promise";
import "./matchers/to-be-called-with-delay";
import { sequelize } from "models/sequelize";
import { dynamodb } from "config/dynamodb";
import IORedis from "ioredis";
import { getRedisInfo } from "config/redis-info";
import { GitHubAppConfig } from "~/src/sqs/sqs.types";
import { resetEnvVars, TestEnvVars } from "test/setup/env-test";
import { GitHubConfig } from "~/src/github/client/github-client";
// WARNING: Be very careful what you import here as it might affect test
// in other tests because of dependency tree.  Keep imports to a minimum.
jest.mock("lru-cache");

const redis = new IORedis(getRedisInfo("test"));

type GithubUserTokenNockFunc = (id: number, returnToken?: string, expires?: number, expectedAuthToken?: string) => nock.Scope
type GithubAppTokenNockFunc = () => nock.Scope
type MockSystemTimeFunc = (time: number | string | Date) => jest.MockInstance<number, []>;

export const testEnvVars: TestEnvVars = envVars as TestEnvVars;
declare global {
	let jiraHost: string;
	let gitHubAppConfig: GitHubAppConfig;
	let gitHubCloudConfig: GitHubConfig;
	let jiraStaginHost: string;
	let jiraNock: nock.Scope;
	let jiraStagingNock: nock.Scope;
	let githubNock: nock.Scope;
	let gheUrl: string;
	let uuid: string;
	let gheNock: nock.Scope;
	let gheApiUrl: string;
	let gheApiNock: nock.Scope;
	let githubUserTokenNock: GithubUserTokenNockFunc;
	let githubAppTokenNock: GithubAppTokenNockFunc;
	let gheUserTokenNock: GithubUserTokenNockFunc;
	let gheAppTokenNock: GithubAppTokenNockFunc;
	let mockSystemTime: MockSystemTimeFunc;
	let testEnvVars: TestEnvVars;
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace NodeJS {
		interface Global {
			jiraHost: string;
			gitHubAppConfig: GitHubAppConfig;
			gitHubCloudConfig: GitHubConfig;
			jiraStaginHost: string;
			jiraNock: nock.Scope;
			jiraStagingNock: nock.Scope;
			githubNock: nock.Scope;
			gheUrl: string;
			uuid: string;
			gheNock: nock.Scope;
			gheApiUrl: string;
			gheApiNock: nock.Scope;
			githubUserTokenNock: GithubUserTokenNockFunc;
			githubAppTokenNock: GithubAppTokenNockFunc;
			gheUserTokenNock: GithubUserTokenNockFunc;
			gheAppTokenNock: GithubAppTokenNockFunc;
			mockSystemTime: MockSystemTimeFunc;
			testEnvVars: TestEnvVars;
		}
	}
}

const clearState = async () => Promise.all([
	sequelize.truncate({ truncate: true, cascade: true }),
	purgeItemsInTable(envVars.DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_NAME)
]);

const githubUserToken = (scope: nock.Scope): GithubUserTokenNockFunc =>
	(githubInstallationId: number | string, returnToken = "token", expires = Date.now() + 3600, expectedAuthToken?: string) => {
		return scope
			.post(`/app/installations/${githubInstallationId}/access_tokens`)
			.matchHeader(
				"Authorization",
				expectedAuthToken ? `Bearer ${expectedAuthToken}` : /^(Bearer|token) .+$/i
			)
			.reply(200, {
				token: returnToken,
				expires_at: expires
			});
	};

const githubAppToken = (scope: nock.Scope): GithubAppTokenNockFunc =>
	() => {
		return scope
			.get("/app")
			// .matchHeader("Authorization", /^Bearer .+$/i)
			.reply(200, {
				"id": 1,
				"slug": "octoapp",
				"node_id": "MDExOkludGVncmF0aW9uMQ==",
				"owner": {
					"login": "github",
					"id": 1,
					"node_id": "MDEyOk9yZ2FuaXphdGlvbjE=",
					"url": "https://api.github.com/orgs/github",
					"gravatar_id": "",
					"html_url": "https://github.com/octocat",
					"type": "User",
					"site_admin": true
				},
				"name": "Octocat App",
				"description": "",
				"external_url": "https://example.com",
				"html_url": "https://github.com/apps/octoapp",
				"created_at": "2017-07-08T16:18:44-04:00",
				"updated_at": "2017-07-08T16:18:44-04:00",
				"permissions": {
					"metadata": "read",
					"contents": "read",
					"issues": "write",
					"single_file": "write"
				},
				"events": [
					"push",
					"pull_request"
				]
			});
	};

beforeAll(async () => {
	resetEnvVars();
	await clearState();
	// clear redis keys
	await redis.flushall();
	redis.disconnect();
});

beforeEach(() => {
	const instance = envVars.APP_KEY.split(".").pop()!;
	global.jiraHost = process.env.ATLASSIAN_URL || `https://${instance}.atlassian.net`;
	global.jiraStaginHost = process.env.ATLASSIAN_URL?.replace(".atlassian.net", ".jira-dev.com") || `https://${instance}.jira-dev.com`;
	global.jiraNock = nock(global.jiraHost);
	global.jiraStagingNock = nock(global.jiraHost);
	global.githubNock = nock("https://api.github.com");
	global.gheUrl = "https://github.mydomain.com";
	global.uuid = "c97806fc-c433-4ad5-b569-bf5191590be2";
	global.gheNock = nock(global.gheUrl);
	global.gheApiUrl = `${global.gheUrl}/api/v3`;
	global.gheApiNock = nock(global.gheApiUrl);
	global.githubUserTokenNock = githubUserToken(githubNock);
	global.githubAppTokenNock = githubAppToken(githubNock);
	global.gheUserTokenNock = githubUserToken(gheApiNock);
	global.gheAppTokenNock = githubAppToken(gheApiNock);
	global.testEnvVars = envVars as TestEnvVars;
	global.mockSystemTime = (time: number | string | Date) => {
		const mock = jest.isMockFunction(Date.now) ? jest.mocked(Date.now) : jest.spyOn(Date, "now");
		mock.mockReturnValue(new Date(time).getTime());
		return mock;
	};
	global.gitHubCloudConfig = {
		hostname: "https://github.com",
		baseUrl: "https://github.com",
		apiUrl: "https://api.github.com",
		graphqlUrl: "https://api.github.com/graphql"
	};
});

// Checks to make sure there's no extra HTTP mocks waiting
// Needs to be in it's own aftereach so that the expect doesn't stop it from cleaning up afterwards
afterEach(async () => {
	try {
		// eslint-disable-next-line jest/no-standalone-expect
		expect(nock).toBeDone();
	} finally {
		nockCleanAll(); // removes HTTP mocks
		jest.resetAllMocks(); // Removes jest mocks
		jest.restoreAllMocks();
		await clearState();
		resetEnvVars();
	}
});

afterAll(async () => {
	// TODO: probably missing things like redis and other things that need to close down
	// Close connection when tests are done
	await sequelize.close();
});

export const purgeItemsInTable = async (tableName: string) => {

	try {

		const rows = await dynamodb.scan({
			TableName: tableName,
			AttributesToGet: [ "Id", "CreatedAt" ]
		}).promise();

		const deleteRequests: Promise<unknown>[] = ((rows.Items || []).map(item => {
			return dynamodb.deleteItem({
				TableName: tableName,
				Key: {
					"Id": { "S": item.Id.S },
					"CreatedAt": { "N" : item.CreatedAt.N }
				}
			}).promise();
		}));

		await Promise.all(deleteRequests);

	} catch (e: unknown) {
		//do nothing as this method is for local test only
	}

};

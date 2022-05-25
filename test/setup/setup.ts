import nock from "nock";
import { envVars } from "config/env";
import "./matchers/nock";
import "./matchers/to-promise";
import "./matchers/to-have-sent-metrics";
import "./matchers/to-be-called-with-delay";
import { sequelize } from "models/sequelize";
import { mocked } from "ts-jest/utils";
import IORedis from "ioredis";
import { getRedisInfo } from "config/redis-info";
// WARNING: Be very careful what you import here as it might affect test
// in other tests because of dependency tree.  Keep imports to a minimum.
jest.mock("lru-cache");

const redis = new IORedis(getRedisInfo("test"));

type GithubUserTokenNockFunc = (id: number, returnToken?: string, expires?: number, expectedAuthToken?: string) => void
type GithubAppTokenNockFunc = () => void
type MockSystemTimeFunc = (time: number | string | Date) => jest.MockInstance<number, []>;

declare global {
	let jiraHost: string;
	let jiraStaginHost: string;
	let jiraNock: nock.Scope;
	let jiraStagingNock: nock.Scope;
	let githubNock: nock.Scope;
	let gheNock: nock.Scope;
	let gheUrl: string;
	let githubUserTokenNock: GithubUserTokenNockFunc;
	let githubAppTokenNock: GithubAppTokenNockFunc;
	let gheUserTokenNock: GithubUserTokenNockFunc;
	let gheAppTokenNock: GithubAppTokenNockFunc;
	let mockSystemTime: MockSystemTimeFunc;
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace NodeJS {
		interface Global {
			jiraHost: string;
			jiraStaginHost: string;
			jiraNock: nock.Scope;
			jiraStagingNock: nock.Scope;
			githubNock: nock.Scope;
			gheNock: nock.Scope;
			gheUrl: string;
			githubUserTokenNock: GithubUserTokenNockFunc;
			githubAppTokenNock: GithubAppTokenNockFunc;
			gheUserTokenNock: GithubUserTokenNockFunc;
			gheAppTokenNock: GithubAppTokenNockFunc;
			mockSystemTime: MockSystemTimeFunc;
		}
	}
}


const resetEnvVars = () => {
	// Assign defaults to process.env, but don't override existing values if they
	// are already set in the environment.
	process.env = {
		...process.env,
		...envVars
	};
};

const clearState = async () => Promise.all([
	sequelize.truncate({ truncate: true })
]);

const githubUserToken = (scope: nock.Scope): GithubUserTokenNockFunc =>
	(installationId: number | string, returnToken = "token", expires = Date.now() + 3600, expectedAuthToken?: string) => {
		scope
			.post(`/app/installations/${installationId}/access_tokens`)
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
		scope
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
	global.jiraHost = process.env.ATLASSIAN_URL || `https://${process.env.INSTANCE_NAME}.atlassian.net`;
	global.jiraStaginHost = process.env.ATLASSIAN_URL?.replace(".atlassian.net", ".jira-dev.com") || `https://${process.env.INSTANCE_NAME}.jira-dev.com`;
	global.jiraNock = nock(global.jiraHost);
	global.jiraStagingNock = nock(global.jiraHost);
	global.githubNock = nock("https://api.github.com");
	global.gheUrl = "https://github.mydomain.com";
	global.gheNock = nock(global.gheUrl);
	global.githubUserTokenNock = githubUserToken(githubNock);
	global.githubAppTokenNock = githubAppToken(githubNock);
	global.gheUserTokenNock = githubUserToken(gheNock);
	global.gheAppTokenNock = githubAppToken(gheNock);
	global.mockSystemTime = (time: number | string | Date) => {
		const mock = jest.isMockFunction(Date.now) ? mocked(Date.now) : jest.spyOn(Date, "now");
		mock.mockReturnValue(new Date(time).getTime());
		return mock;
	};
});

// Checks to make sure there's no extra HTTP mocks waiting
// Needs to be in it's own aftereach so that the expect doesn't stop it from cleaning up afterwards
afterEach(async () => {
	try {
		// eslint-disable-next-line jest/no-standalone-expect
		expect(nock).toBeDone();
	} finally {
		nock.cleanAll(); // removes HTTP mocks
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

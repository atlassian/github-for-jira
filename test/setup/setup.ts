import nock from "nock";
import env from "../../src/config/env";
import "./matchers/to-have-sent-metrics";
import "./matchers/nock";
import "./matchers/to-promise";
import statsd from "../../src/config/statsd";
import { sequelize } from "../../src/models/sequelize";
import { sqsQueues } from "../../src/sqs/queues";

// Mocking lru-cache to disable it completely while doing tests
jest.mock("lru-cache");

resetEnvVars();

function resetEnvVars() {
	// Assign defaults to process.env, but don't override existing values if they
	// are already set in the environment.
	process.env = {
		...process.env,
		...env
	};
}

type AccessTokenNockFunc = (id: number, returnToken?: string, expires?: number, expectedAuthToken?: string) => void

declare global {
	let jiraHost: string;
	let jiraNock: nock.Scope;
	let githubNock: nock.Scope;
	let gheNock: nock.Scope;
	let gheUrl: string;
	let githubAccessTokenNock: AccessTokenNockFunc;
	let gheAccessTokenNock: AccessTokenNockFunc;
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace NodeJS {
		interface Global {
			jiraHost: string;
			jiraNock: nock.Scope;
			githubNock: nock.Scope;
			gheNock: nock.Scope;
			gheUrl: string;
			githubAccessTokenNock: AccessTokenNockFunc;
			gheAccessTokenNock: AccessTokenNockFunc;
		}
	}
}

const accessToken = (scope: nock.Scope): AccessTokenNockFunc =>
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

beforeAll(async () => {
	// purge all queues before starting in case there's a message in there.
	await sqsQueues.purge();
})

beforeEach(() => {
	resetEnvVars();
	global.jiraHost = process.env.ATLASSIAN_URL || "";
	global.jiraNock = nock(global.jiraHost);
	global.githubNock = nock("https://api.github.com");
	global.gheUrl = "https://github.mydomain.com";
	global.gheNock = nock(global.gheUrl);
	global.githubAccessTokenNock = accessToken(githubNock);
	global.gheAccessTokenNock = accessToken(gheNock);
});

// Checks to make sure there's no extra HTTP mocks waiting
// Needs to be in it's own aftereach so that the expect doesn't stop it from cleaning up afterwards
afterEach(() => {
	try {
		// eslint-disable-next-line jest/no-standalone-expect
		expect(nock).toBeDone();
	} finally {
		nock.cleanAll(); // removes HTTP mocks
		jest.resetAllMocks(); // Removes jest mocks
		jest.useRealTimers(); // Resets timers
		// jest.resetModules(); // clears NPM require cache
	}
});

afterAll(async () => {
	// TODO: probably missing things like redis and other things that need to close down
	// Close connection when tests are done
	await sequelize.close();
	// stop only if setup did run. If using jest --watch and no tests are matched
	// we need to not execute the require() because it will fail
	// TODO: fix wrong typing for statsd
	statsd.close(() => undefined);
});

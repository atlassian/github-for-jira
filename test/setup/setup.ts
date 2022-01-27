// Mocking lru-cache to disable it completely while doing tests
jest.mock("lru-cache");
jest.mock("../../src/config/feature-flags");

import nock from "nock";
import env from "../../src/config/env";
import "./matchers/to-have-sent-metrics";
import "./matchers/nock";
import "./matchers/to-promise";
import statsd from "../../src/config/statsd";
import { sequelize } from "../../src/models/sequelize";
import { Installation, RepoSyncState, Subscription } from "../../src/models";
import { sqsQueues } from "../../src/sqs/queues";


resetEnvVars();

function resetEnvVars() {
	// Assign defaults to process.env, but don't override existing values if they
	// are already set in the environment.
	process.env = {
		...process.env,
		...env
	};
}

let dateNowMock: jest.SpyInstance | undefined;

type AccessTokenNockFunc = (id: number, returnToken?: string, expires?: number, expectedAuthToken?: string) => void
type MockSystemTimeFunc = (time: string | number | Date) => void;
// type MockFeatureFlagFunc = (flag: BooleanFlags | StringFlags) => void;

declare global {
	let jiraHost: string;
	let jiraNock: nock.Scope;
	let githubNock: nock.Scope;
	let gheNock: nock.Scope;
	let gheUrl: string;
	let githubAccessTokenNock: AccessTokenNockFunc;
	let gheAccessTokenNock: AccessTokenNockFunc;
	let mockSystemTime: MockSystemTimeFunc;
	// let mockFeatureFlag: MockFeatureFlagFunc;
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
			mockSystemTime: MockSystemTimeFunc;
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

const clearDbState = async () => Promise.all([
	Subscription.destroy({ truncate: true }),
	Installation.destroy({ truncate: true }),
	RepoSyncState.destroy({ truncate: true })
]);

const clearState = async () => Promise.all([
	// sqsQueues.purge(),
	clearDbState()
]);

beforeAll(async () => {
	// clear state of queues and DB before starting anything
	// This is in case you're forcefully exiting test which doesn't run afterEach
	await clearState();
	const messageCount = await sqsQueues.getMessageCount();
	console.log(`Queue message count: ${JSON.stringify(messageCount, null, 4)}`);
});

beforeEach(() => {
	resetEnvVars();
	global.jiraHost = process.env.ATLASSIAN_URL || "";
	global.jiraNock = nock(global.jiraHost);
	global.githubNock = nock("https://api.github.com");
	global.gheUrl = "https://github.mydomain.com";
	global.gheNock = nock(global.gheUrl);
	global.githubAccessTokenNock = accessToken(githubNock);
	global.gheAccessTokenNock = accessToken(gheNock);
	global.mockSystemTime = (time: string | number | Date = jest.getRealSystemTime()) => {
		if(!dateNowMock) {
			dateNowMock = jest.spyOn(Date, "now");
		}
		dateNowMock.mockImplementation(() => ({now: () => new Date(time).getTime()}));
	}

	// jest.spyOn(featureFlags, "booleanFlag")

	// jest.useFakeTimers(); // Set fake timers/Date object
	// jest.setSystemTime(jest.getRealSystemTime()); // set time to now

});

// Checks to make sure there's no extra HTTP mocks waiting
// Needs to be in it's own aftereach so that the expect doesn't stop it from cleaning up afterwards
afterEach(async () => {
	try {
		// eslint-disable-next-line jest/no-standalone-expect
		expect(nock).toBeDone();
	} finally {
		await clearState();
		dateNowMock?.mockRestore();
		dateNowMock = undefined;
		nock.cleanAll(); // removes HTTP mocks
		jest.resetAllMocks(); // Removes jest mocks
		jest.restoreAllMocks(); // Removes jest mocks
		jest.clearAllTimers(); // Invalidate all timers
		jest.useRealTimers(); // Resets timers
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

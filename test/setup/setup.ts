import nock from "nock";
import env from "../../src/config/env";
import "./matchers/to-have-sent-metrics";
import "./matchers/nock";
import "./matchers/to-promise";
// WARNING: Be very careful what you import here as it might affect test
// in other others because of dependency tree.  Keep imports to a minimum.

jest.mock("lru-cache");

const resetEnvVars = () => {
	// Assign defaults to process.env, but don't override existing values if they
	// are already set in the environment.
	process.env = {
		...process.env,
		...env
	};
}

declare global {
	let jiraHost: string;
	let jiraNock: nock.Scope;
	let githubNock: nock.Scope;
	let gheNock: nock.Scope;
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace NodeJS {
		interface Global {
			jiraHost: string;
			jiraNock: nock.Scope;
			githubNock: nock.Scope;
			gheNock: nock.Scope;
		}
	}
}

beforeAll(() => {
	resetEnvVars();
});

beforeEach(() => {
	global.jiraHost = process.env.ATLASSIAN_URL || "";
	global.jiraNock = nock(global.jiraHost);
	global.githubNock = nock("https://api.github.com");
	global.gheNock = nock("http://github.mydomain.com");
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
		jest.restoreAllMocks();
		resetEnvVars();
	}
});

afterAll(async () => {
	// TODO: probably missing things like redis and other things that need to close down
	// Close connection when tests are done
	// await sequelize.close();
	// stop only if setup did run. If using jest --watch and no tests are matched
	// we need to not execute the require() because it will fail
	// TODO: fix wrong typing for statsd
	// statsd.close(() => undefined);
});

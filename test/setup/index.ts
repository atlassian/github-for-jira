import nock from "nock";
import dotenv from "dotenv";
import "./matchers/to-have-sent-metrics";
import "./matchers/nock";
import "./matchers/to-promise";
import { sequelize } from "../../src/models";
resetEnvVars();

function resetEnvVars() {
  dotenv.config();
  // Assign defaults to process.env, but don't override existing values if they
  // are already set in the environment.
  process.env = {
    ...process.env,
    NODE_ENV: "test",
    APP_URL: "https://test-github-app-instance.com",
    ATLASSIAN_URL: "https://test-atlassian-instance.net",
    HYDRO_BASE_URL: "https://hydro-base-url.com/api/v1/events",
    ATLASSIAN_SECRET: "test-secret",
    // Generated for tests
    HYDRO_APP_SECRET: "2dd220c366ec5b86104efd7324c2d405",
    PRIVATE_KEY_PATH: "./test/setup/test-key.pem",
    GITHUB_CLIENT_SECRET: "test-github-secret",
    LOG_LEVEL: "info",
    // Don't worry about this key. It is just for testing.
    STORAGE_SECRET: "8cad66340bc92edbae2ae3a792d351f48c61d1d8efe7b2d9408b0025c1f7f845",
    SETUP: "yes", // indicates that the setup did run
    TRACKING_DISABLED: "true"
  };
}

declare global {
  let jiraHost: string;
  let jiraNock: nock.Scope;
  let githubNock: nock.Scope;
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      jiraHost: string;
      jiraNock: nock.Scope;
      githubNock: nock.Scope;
    }
  }
}

beforeEach(() => {
  resetEnvVars();
  global.jiraHost = process.env.ATLASSIAN_URL;
  global.jiraNock = nock(process.env.ATLASSIAN_URL);
  global.githubNock = nock("https://api.github.com");
});

// Checks to make sure there's no extra HTTP mocks waiting
// Needs to be in it's own aftereach so that the expect doesn't stop it from cleaning up afterwards
afterEach(() => {
  // eslint-disable-next-line jest/no-standalone-expect
  expect(nock).toBeDone();
})

afterEach(async () => {
  nock.cleanAll(); // removes HTTP mocks
  jest.resetAllMocks(); // Removes jest mocks
});

afterAll(async () => {
  // Close connection when tests are done
  await sequelize.close()
})

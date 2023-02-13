import { preemptiveRateLimitCheck } from "utils/preemptive-rate-limit";
import { when } from "jest-when";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { GitHubServerApp } from "models/github-server-app";
import fs from "fs";
import path from "path";
import { createWebhookApp } from "test/utils/create-webhook-app";
import { Installation } from "models/installation";
import { v4 as UUID } from "uuid";

jest.mock("config/feature-flags");

const TEST_INSTALLATION_ID = 1234;

const mockGitHubRateLimit = (limit , remaining) => {
	githubUserTokenNock(TEST_INSTALLATION_ID);
	githubNock.get(`/rate_limit`)
		.reply(200, {
			"resources": {
				"core": {
					"limit": limit,
					"remaining": remaining,
					"reset": 1372700873
				},
				"graphql": {
					"limit": 5000,
					"remaining": 5000,
					"reset": 1372700389
				}
			}
		});
};

const mockGitHubEnterpriseRateLimit = (limit , remaining) => {
	gheUserTokenNock(TEST_INSTALLATION_ID);
	gheNock.get(`/api/v3/rate_limit`)
		.reply(200, {
			"resources": {
				"core": {
					"limit": limit,
					"remaining": remaining,
					"reset": 1372700873
				},
				"graphql": {
					"limit": 5000,
					"remaining": 5000,
					"reset": 1372700389
				}
			}
		});
};

describe("Preemptive rate limit check - Cloud", () => {

	it(`Should return true since the remaining percent is greater than the threshold`, async () => {

		when(numberFlag).calledWith(
			NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(50);

		mockGitHubRateLimit(100, 30);
		const message = {
			payload: {
				jiraHost: "JIRAHOST_MOCK",
				installationId: TEST_INSTALLATION_ID,
				gitHubAppConfig: {
					gitHubAppId: 1
				}
			},
			message: {},
			log: {
				info: jest.fn(),
				warn: jest.fn()
			}
		};
		const sqsQueue = {
			queueName: "backfill",
			changeVisibilityTimeout: jest.fn()
		};
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await preemptiveRateLimitCheck(message, sqsQueue)).toBe(true);
	});

	it(`Should return false since threshold is not met`, async () => {

		when(numberFlag).calledWith(
			NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(90);

		mockGitHubRateLimit(100, 99);
		const sqsQueue = {
			queueName: "backfill",
			changeVisibilityTimeout: jest.fn()
		};
		const message = {
			payload: {
				jiraHost: "JIRAHOST_MOCK",
				installationId: TEST_INSTALLATION_ID,
				gitHubAppConfig: {
					gitHubAppId: 1
				}
			},
			message: {},
			log: {
				info: jest.fn(),
				warn: jest.fn()
			}
		};
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await preemptiveRateLimitCheck(message, sqsQueue)).toBe(false);
	});

	it(`Should not attempt to preempt when invalid quene name`, async () => {
		const sqsQueue = {
			queueName: "cats",
			changeVisibilityTimeout: jest.fn()
		};
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await preemptiveRateLimitCheck({}, sqsQueue)).toBe(false);
	});

});



describe.skip("Preemptive rate limit check - GHE", () => {
	let gitHubServerApp: GitHubServerApp;


	beforeEach(async () => {
		//
		const GHE_PEM = fs.readFileSync(path.resolve(__dirname, "../../test/setup/test-key.pem"), { encoding: "utf8" });

		await createWebhookApp();
		const clientKey = "client-key";
		const installation = await Installation.create({
			clientKey,
			encryptedSharedSecret: "shared-secret",
			jiraHost
		});

		gitHubServerApp = await GitHubServerApp.install({
			uuid: UUID(),
			appId: 5678,
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "ghe_client_id",
			gitHubClientSecret: "ghe_client_secret",
			webhookSecret: "ghe_webhook_secret",
			privateKey: GHE_PEM,
			gitHubAppName: "ghe_app_name",
			installationId: installation.id
		}, jiraHost);
	});

	it(`Should return true since the remaining percent is greater than the threshold`, async () => {

		when(numberFlag).calledWith(
			NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(50);

		gheUserTokenNock(TEST_INSTALLATION_ID);
		mockGitHubEnterpriseRateLimit(100, 30);
		const callback = jest.fn();
		const MOCK_QUEUE_NAME = "backfill";
		const message = {
			payload: {
				jiraHost,
				installationId: TEST_INSTALLATION_ID,
				gitHubAppConfig: {
					gitHubAppId: gitHubServerApp.id,
					appId: gitHubServerApp.appId,
					clientId: gitHubServerApp.gitHubClientId,
					gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
					gitHubApiUrl: gitHubServerApp.gitHubBaseUrl,
					uuid: gitHubServerApp.uuid
				}
			},
			message: {},
			log: {
				info: jest.fn(),
				warn: jest.fn()
			}
		};
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await preemptiveRateLimitCheck(message, MOCK_QUEUE_NAME, callback)).toBe(true);
	});

	it(`Should return false since threshold is not met`, async () => {

		when(numberFlag).calledWith(
			NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(90);

		mockGitHubEnterpriseRateLimit(100, 99);
		const callback = jest.fn();
		const MOCK_QUEUE_NAME = "backfill";
		const message = {
			payload: {
				jiraHost: "JIRAHOST_MOCK",
				installationId: TEST_INSTALLATION_ID,
				gitHubAppConfig: {
					gitHubAppId: gitHubServerApp.id,
					appId: gitHubServerApp.appId,
					clientId: gitHubServerApp.gitHubClientId,
					gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
					gitHubApiUrl: gitHubServerApp.gitHubBaseUrl,
					uuid: gitHubServerApp.uuid
				}

			},
			message: {},
			log: {
				info: jest.fn(),
				warn: jest.fn()
			}
		};
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await preemptiveRateLimitCheck(message, MOCK_QUEUE_NAME, callback)).toBe(false);
	});

	it(`Should not attempt to preempt when invalid quene name`, async () => {
		const callback = jest.fn();
		const MOCK_QUEUE_NAME = "cats";
		const message = {};
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await preemptiveRateLimitCheck(message, MOCK_QUEUE_NAME, callback)).toBe(false);
	});

});

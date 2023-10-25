/* eslint-disable jest/expect-expect */
import { Installation } from "models/installation";
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";
import { sqsQueues } from "./queues";
import { waitUntil } from "test/utils/wait-until";

import getRepositories from "fixtures/get-repositories.json";
import { GetRepositoriesQuery } from "~/src/github/client/github-queries";

import { GitHubServerApp } from "models/github-server-app";
import { v4 as UUID } from "uuid";
import fs from "fs";
import path from "path";
import { createWebhookApp } from "test/utils/create-webhook-app";
import { when } from "jest-when";
import { numberFlag, NumberFlags } from "config/feature-flags";

jest.mock("config/feature-flags");

describe("Discovery Queue Test - GitHub Client", () => {
	const TEST_INSTALLATION_ID = 1234;

	let gitHubServerApp: GitHubServerApp;

	beforeAll(async () => {
		await sqsQueues.backfill.purgeQueue();
	});

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


		//Cloud
		await Subscription.create({
			jiraHost,
			gitHubInstallationId: TEST_INSTALLATION_ID,
			jiraClientKey: clientKey
		});

		//GHES
		await Subscription.create({
			jiraHost,
			gitHubInstallationId: TEST_INSTALLATION_ID, //Same as cloud
			jiraClientKey: clientKey,
			gitHubAppId: gitHubServerApp.id
		});

		sqsQueues.backfill.start();

		when(numberFlag).calledWith(
			NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
			100,
			jiraHost
		).mockResolvedValue(100);
	});

	afterEach(async () => {
		await sqsQueues.backfill.stop();
		await sqsQueues.backfill.purgeQueue();
	});

	const mockGitHubReposResponses = () => {
		githubUserTokenNock(TEST_INSTALLATION_ID);
		githubNock
			.post("/graphql", { query: GetRepositoriesQuery, variables: { per_page: 20 } })
			.reply(200, { data: getRepositories });
	};

	const mockGitHubEnterpriseReposResponses = () => {
		gheUserTokenNock(TEST_INSTALLATION_ID);
		gheNock
			.post("/api/graphql", { query: GetRepositoriesQuery, variables: { per_page: 20 } })
			.reply(200, { data: getRepositories });
	};

	const rateLimitResponse = {
		"resources": {
			"core": {
				"limit": 100,
				"remaining": 100,
				"reset": 1372700873
			},
			"graphql": {
				"limit": 5000,
				"remaining": 5000,
				"reset": 1372700389
			}
		}
	};

	const mockGitHubRateLimit = () => {
		githubUserTokenNock(TEST_INSTALLATION_ID);
		githubNock.get(`/rate_limit`)
			.reply(200, rateLimitResponse);
	};
	const mockGitHubEnterpriseRateLimit = () => {
		gheUserTokenNock(TEST_INSTALLATION_ID);
		gheNock.get(`/api/v3/rate_limit`)
			.reply(200, rateLimitResponse);
	};

	it("Discovery sqs queue processes the message for cloud", async () => {
		mockGitHubReposResponses();
		mockGitHubRateLimit();

		await sqsQueues.backfill.sendMessage({ installationId: TEST_INSTALLATION_ID, jiraHost });
		await waitUntil(async () => {
			const subscription = await Subscription.getSingleInstallation(jiraHost, TEST_INSTALLATION_ID, undefined);
			expect(subscription).toBeTruthy();
			const states = await RepoSyncState.findAllFromSubscription(subscription!, 100, 0, [["id", "ASC"]]);
			expect(states?.length).toBe(2);
		});
	});

	it("Discovery sqs queue processes the message for GHES", async () => {
		mockGitHubEnterpriseReposResponses();
		mockGitHubEnterpriseRateLimit();
		await sqsQueues.backfill.sendMessage({
			installationId: TEST_INSTALLATION_ID,
			jiraHost,
			gitHubAppConfig: {
				gitHubAppId: gitHubServerApp.id,
				appId: gitHubServerApp.appId,
				clientId: gitHubServerApp.gitHubClientId,
				gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
				gitHubApiUrl: gitHubServerApp.gitHubBaseUrl,
				uuid: gitHubServerApp.uuid
			}
		});
		await waitUntil(async () => {
			const subscription = await Subscription.getSingleInstallation(jiraHost, TEST_INSTALLATION_ID, gitHubServerApp.id);
			expect(subscription).toBeTruthy();
			const states = await RepoSyncState.findAllFromSubscription(subscription!, 100, 0, [["id", "ASC"]]);
			expect(states?.length).toBe(2);
		});
	});
});

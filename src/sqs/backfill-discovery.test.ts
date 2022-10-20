/* eslint-disable jest/expect-expect */
import { Installation } from "models/installation";
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";
import { sqsQueues } from "./queues";
import { createWebhookApp } from "test/utils/probot";
import { waitUntil } from "test/utils/wait-until";

import getRepositories from "fixtures/get-repositories.json";
import { GetRepositoriesQuery } from "~/src/github/client/github-queries";

import { GitHubServerApp } from "models/github-server-app";
import { v4 as UUID } from "uuid";
import fs from "fs";
import path from "path";

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
		});


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

		await sqsQueues.backfill.start();
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

	it("Discovery sqs queue processes the message for cloud", async () => {
		mockGitHubReposResponses();
		await sqsQueues.backfill.sendMessage({ installationId: TEST_INSTALLATION_ID, jiraHost });
		await waitUntil(async () => {
			const subscription = await Subscription.getSingleInstallation(jiraHost, TEST_INSTALLATION_ID, undefined);
			expect(subscription).toBeTruthy();
			const states = await RepoSyncState.findAllFromSubscription(subscription!);
			expect(states?.length).toBe(2);
		});
	});

	it("Discovery sqs queue processes the message for GHES", async () => {
		mockGitHubEnterpriseReposResponses();
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
			const states = await RepoSyncState.findAllFromSubscription(subscription!);
			expect(states?.length).toBe(2);
		});
	});
});

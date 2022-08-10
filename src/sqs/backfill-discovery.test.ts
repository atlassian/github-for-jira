/* eslint-disable jest/expect-expect */
import { Installation } from "models/installation";
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";
import { sqsQueues } from "./queues";
import { createWebhookApp } from "test/utils/probot";
import { waitUntil } from "test/utils/wait-until";

import getRepositories from "fixtures/get-repositories.json";
import { GetRepositoriesQuery } from "~/src/github/client/github-queries";

describe("Discovery Queue Test - GitHub Client", () => {
	const TEST_INSTALLATION_ID = 1234;

	beforeAll(async () => {
		await sqsQueues.backfill.purgeQueue();
	});

	beforeEach(async () => {
		await createWebhookApp();
		const clientKey = "client-key";
		await Installation.create({
			clientKey,
			sharedSecret: "shared-secret",
			jiraHost
		});

		await Subscription.create({
			jiraHost,
			gitHubInstallationId: TEST_INSTALLATION_ID,
			jiraClientKey: clientKey
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

	it("Discovery sqs queue processes the message", async () => {
		mockGitHubReposResponses();
		await sqsQueues.backfill.sendMessage({ installationId: TEST_INSTALLATION_ID, jiraHost });
		await waitUntil(async () => {
			const subscription = await Subscription.getSingleInstallation(jiraHost, TEST_INSTALLATION_ID);
			expect(subscription).toBeTruthy();
			const states = await RepoSyncState.findAllFromSubscription(subscription!);
			expect(states?.length).toBe(2);
		});
	});
});

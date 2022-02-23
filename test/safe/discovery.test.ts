import { Installation, RepoSyncState, Subscription } from "../../src/models";
import { sqsQueues } from "../../src/sqs/queues";
import { createWebhookApp } from "../utils/probot";
import app from "../../src/worker/app";
import { discovery, discoveryOctoKit } from "../../src/sync/discovery";
import { getLogger } from "../../src/config/logger";
import waitUntil from "../utils/waitUntil";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "../../src/config/feature-flags";

jest.mock("../../src/config/feature-flags");

describe("Discovery Queue Test - Ocktokit", () => {
	const TEST_INSTALLATION_ID = 1234;
	let sendMessageSpy: jest.SpyInstance;

	beforeAll(async () => {
		await sqsQueues.branch.purgeQueue();
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

		await sqsQueues.discovery.start();

		sendMessageSpy = jest.spyOn(sqsQueues.backfill, "sendMessage");
	});

	afterEach(async () => {
		await sqsQueues.discovery.stop();
		await sqsQueues.discovery.purgeQueue();
	});

	const mockGitHubReposResponses = () => {
		githubAccessTokenNock(TEST_INSTALLATION_ID);
		githubNock.get("/installation/repositories?per_page=100")
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			.reply(200, require("../fixtures/list-repositories.json"));
	};

	async function verify2RepositoriesInTheStateAndBackfillMessageSent() {
		expect(sendMessageSpy).toBeCalledTimes(1);
		const subscription = await Subscription.getSingleInstallation(jiraHost, TEST_INSTALLATION_ID);
		expect(subscription).toBeTruthy();
		const states = await RepoSyncState.findAllFromSubscription(subscription!);
		expect(states.length).toBe(2);
	}

	// eslint-disable-next-line jest/expect-expect
	it("Discovery sqs queue processes the message", async () => {
		mockGitHubReposResponses();
		await sqsQueues.discovery.sendMessage({ installationId: TEST_INSTALLATION_ID, jiraHost });
		await waitUntil(async () => {
			await verify2RepositoriesInTheStateAndBackfillMessageSent();
		});
	});

	// eslint-disable-next-line jest/expect-expect
	it("Discovery queue listener works correctly", async () => {
		mockGitHubReposResponses();
		await discoveryOctoKit(app)({ data: { installationId: TEST_INSTALLATION_ID, jiraHost } }, getLogger("test"));
		await verify2RepositoriesInTheStateAndBackfillMessageSent();
	});
});

describe("Discovery Queue Test - GitHub Client", () => {
	const TEST_INSTALLATION_ID = 1234;
	let sendMessageSpy: jest.SpyInstance;

	beforeAll(async () => {
		await sqsQueues.branch.purgeQueue();
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

		when(booleanFlag).calledWith(
			BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_DISCOVERY,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(true);

		await sqsQueues.discovery.start();

		sendMessageSpy = jest.spyOn(sqsQueues.backfill, "sendMessage");
	});

	afterEach(async () => {
		await sqsQueues.discovery.stop();
		await sqsQueues.discovery.purgeQueue();
	});

	const mockGitHubReposResponses = () => {
		githubAccessTokenNock(TEST_INSTALLATION_ID);
		const linkLastPage = "<https://api.github.com/installation/repositories?per_page=1&page=2>; rel=\"prev\", <https://api.github.com/installation/repositories?per_page=1&page=2>; rel=\"first\"";
		githubNock
			.get("/installation/repositories?per_page=100&page=0")
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			.reply(200, require("../fixtures/list-repositories.json"), { "link": linkLastPage });
	};

	async function verify2RepositoriesInTheStateAndBackfillMessageSent() {
		expect(sendMessageSpy).toBeCalledTimes(1);
		const subscription = await Subscription.getSingleInstallation(jiraHost, TEST_INSTALLATION_ID);
		expect(subscription).toBeTruthy();
		const states = await RepoSyncState.findAllFromSubscription(subscription!);
		expect(states.length).toBe(2);
	}

	// eslint-disable-next-line jest/expect-expect
	it("Discovery sqs queue processes the message", async () => {
		mockGitHubReposResponses();
		await sqsQueues.discovery.sendMessage({ installationId: TEST_INSTALLATION_ID, jiraHost });
		await waitUntil(async () => {
			await verify2RepositoriesInTheStateAndBackfillMessageSent();
		});
	});

	// eslint-disable-next-line jest/expect-expect
	it("Discovery queue listener works correctly", async () => {
		mockGitHubReposResponses();
		await discovery({ data: { installationId: TEST_INSTALLATION_ID, jiraHost } }, getLogger("test"));
		await verify2RepositoriesInTheStateAndBackfillMessageSent();
	});

});

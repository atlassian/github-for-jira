import { Installation, RepoSyncState, Subscription } from "../../src/models";
// import { start, stop } from "../../src/worker/startup";
import { sqsQueues } from "../../src/sqs/queues";
import { createWebhookApp } from "../utils/probot";
import app from "../../src/worker/app";
import { discovery } from "../../src/sync/discovery";
import { getLogger } from "../../src/config/logger";
import waitUntil from "../utils/waitUntil";

jest.mock("../../src/config/feature-flags");

describe("Discovery Queue Test", () => {

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
		// await stop();

		await sqsQueues.discovery.stop();
		await sqsQueues.discovery.purgeQueue();
	});

	const mockGitHubReposResponses = () => {
		githubAccessTokenNock(1234);

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

	it("Discovery sqs queue processes the message", async () => {
		mockGitHubReposResponses();
		await sqsQueues.discovery.sendMessage({ installationId: TEST_INSTALLATION_ID, jiraHost });
		await waitUntil(async () => {
			await verify2RepositoriesInTheStateAndBackfillMessageSent();
		});
	});

	it("Discovery queue listener works correctly", async () => {
		mockGitHubReposResponses();
		await discovery(app)({ data: { installationId: TEST_INSTALLATION_ID, jiraHost } }, getLogger("test"));
		await waitUntil(async () => {
			await verify2RepositoriesInTheStateAndBackfillMessageSent();
		});
	});
});

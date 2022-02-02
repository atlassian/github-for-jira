import { Installation, RepoSyncState, Subscription } from "../../src/models";
import { start, stop } from "../../src/worker/startup";
import sqsQueues from "../../src/sqs/queues";
import { createWebhookApp } from "../utils/probot";
import app from "../../src/worker/app";
import { discovery } from "../../src/sync/discovery";
import { getLogger } from "../../src/config/logger";
import waitUntil from "../utils/waitUntil";
import RepoConfigDatabaseModel from "../../src/config-as-code/repo-config-database-model";
import { mocked } from "ts-jest/utils";
import { booleanFlag } from "../../src/config/feature-flags";

jest.mock("../../src/config/feature-flags");

describe("Discovery Queue Test", () => {

	const TEST_INSTALLATION_ID = 1234;

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
	});

	afterEach(async () => {
		await Installation.destroy({ truncate: true })
		await Subscription.destroy({ truncate: true })
	});

	let originalBackfillQueueSendMessageFunction;
	let originalDiscoveryQueueSendMessageFunction;

	beforeAll(async () => {
		//Start worker node for queues processing
		await start();
		originalBackfillQueueSendMessageFunction = sqsQueues.backfill.sendMessage;
		originalDiscoveryQueueSendMessageFunction = sqsQueues.discovery.sendMessage;
		sqsQueues.backfill.sendMessage = jest.fn();
	});

	afterAll(async () => {
		sqsQueues.backfill.sendMessage = originalBackfillQueueSendMessageFunction;
		sqsQueues.discovery.sendMessage = originalDiscoveryQueueSendMessageFunction;
		//Stop worker node
		await stop();
		await sqsQueues.discovery.waitUntilListenerStopped();
	});

	const mockGitHubReposResponses = () => {

		githubNock
			.post("/app/installations/1234/access_tokens")
			.optionally() // TODO: need to remove optionally and make it explicit
			.reply(200, {
				token: "token",
				expires_at: new Date().getTime() + 1_000_000
			});

		githubNock.get("/installation/repositories?per_page=100")
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			.reply(200, require("../fixtures/list-repositories.json"));
	}

	const mockRepoContentResponses = () => {

		githubNock
			.post("/app/installations/1234/access_tokens")
			.optionally() // TODO: need to remove optionally and make it explicit
			.reply(200, {
				token: "token",
				expires_at: new Date().getTime() + 1_000_000
			});

		githubNock.get("/repos/octocat/Hello-World/contents/.jira/config.yml")
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			.reply(200, require("../fixtures/get-repo-content.json"));

	}

	async function verify2RepositoriesInTheStateAndBackfillMessageSent() {

		expect(sqsQueues.backfill.sendMessage).toBeCalledTimes(1);

		const subscription = await Subscription.getSingleInstallation(jiraHost, TEST_INSTALLATION_ID);

		if (!subscription) {
			throw "Subsription should not be null"
		}

		console.log("Checking for subscription ID" + subscription.id)


		const states = await RepoSyncState.findAllFromSubscription(subscription);

		expect(states.length).toBe(2);

	}

	async function verifyRepoConfig() {
		const repoConfig = await RepoConfigDatabaseModel.getForRepo(TEST_INSTALLATION_ID, 1296269);
		expect(repoConfig).toBeTruthy();
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

		await discovery(app)({ installationId: TEST_INSTALLATION_ID, jiraHost }, getLogger("test"))

		await verify2RepositoriesInTheStateAndBackfillMessageSent();
	});

	it("Discovery queue listener DOESN'T schedule repo config discovery messages when feature flag is disabled", async () => {
		mocked(booleanFlag).mockResolvedValue(false);
		sqsQueues.discovery.sendMessage = jest.fn();
		mockGitHubReposResponses();
		await discovery(app)({ installationId: TEST_INSTALLATION_ID, jiraHost }, getLogger("test"))
		expect(sqsQueues.discovery.sendMessage).not.toBeCalled();
	});

	it("Discovery queue listener DOES schedule repo config discovery messages when feature flag is enabled", async () => {
		mocked(booleanFlag).mockResolvedValue(true);
		sqsQueues.discovery.sendMessage = jest.fn();
		mockGitHubReposResponses();
		await discovery(app)({ installationId: TEST_INSTALLATION_ID, jiraHost }, getLogger("test"))
		expect(sqsQueues.discovery.sendMessage).toBeCalledTimes(2);
	});

	it("Discovery queue listener gets repo config from GitHub", async () => {
		mockRepoContentResponses();
		await discovery(app)({
			installationId: TEST_INSTALLATION_ID,
			jiraHost,
			repo: {
				id: 1296269,
				name: "Hello-World",
				owner: "octocat"
			}
		}, getLogger("test"))
		await verifyRepoConfig();
	});


});

import {Installation, RepoSyncState, Subscription} from "../../src/models";
import {start, stop} from "../../src/worker/startup";
import sqsQueues from "../../src/sqs/queues";
import {createWebhookApp} from "../utils/probot";
import app from "../../src/worker/app";
import {discovery} from "../../src/sync/discovery";
import {getLogger} from "../../src/config/logger";
import waitUntil from "../utils/waitUntil";

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
		await Installation.destroy({truncate: true})
		await Subscription.destroy({truncate: true})
	});

	let originalBackfillQueueSendMessageFunction;

	beforeAll(async () => {
		//Start worker node for queues processing
		await start();
		originalBackfillQueueSendMessageFunction = sqsQueues.backfill.sendMessage;
		sqsQueues.backfill.sendMessage = jest.fn();
	});

	afterAll(async () => {
		sqsQueues.backfill.sendMessage = originalBackfillQueueSendMessageFunction;
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


	async function verify2RepositoriesInTheStateAndBackfillMessageSent() {

		expect(sqsQueues.backfill.sendMessage).toBeCalledTimes(1);

		const subscription = await Subscription.getSingleInstallation(jiraHost, TEST_INSTALLATION_ID);

		if (!subscription) {
			throw "Subsription should not be null"
		}

		console.log("Checking for subscription ID" + subscription.id)


		const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription);

		expect(repoSyncStates.length).toBe(2);

	}

	it("Discovery sqs queue processes the message", async () => {


		mockGitHubReposResponses();

		await sqsQueues.discovery.sendMessage({installationId: TEST_INSTALLATION_ID, jiraHost});

		await waitUntil(async () => {

			await verify2RepositoriesInTheStateAndBackfillMessageSent();

		});
	});

	it("Discovery queue listener works correctly", async () => {

		mockGitHubReposResponses();

		await discovery(app)({data: {installationId: TEST_INSTALLATION_ID, jiraHost}}, getLogger("test"))

		await verify2RepositoriesInTheStateAndBackfillMessageSent();
	});


});

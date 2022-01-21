import { Installation, RepoSyncState, Subscription } from "../../src/models";
import { start, stop } from "../../src/worker/startup";
import { sqsQueues } from "../../src/sqs/queues";
import { createWebhookApp } from "../utils/probot";
import app from "../../src/worker/app";
import { discovery } from "../../src/sync/discovery";
import { getLogger } from "../../src/config/logger";
import waitUntil from "../utils/waitUntil";

jest.mock("../../src/config/feature-flags");

describe("Discovery Queue Test", () => {

	const installationId = 1234;

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
			gitHubInstallationId: installationId,
			jiraClientKey: clientKey
		});
		sqsQueues.backfill.sendMessage = jest.fn();

		githubNock.get("/installation/repositories?per_page=100")
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			.reply(200, require("../fixtures/list-repositories.json"));

		//Start worker node for queues processing
		await start();
	});

	afterEach(async () => {
		//Stop worker node
		await stop();
		await Installation.destroy({ truncate: true });
		await Subscription.destroy({ truncate: true });
		await sqsQueues.purge();
	});

	async function verify2RepositoriesInTheStateAndBackfillMessageSent() {
		expect(sqsQueues.backfill.sendMessage).toBeCalledTimes(1);
		const subscription = await Subscription.getSingleInstallation(jiraHost, installationId);

		if (!subscription) {
			throw "Subsription should not be null";
		}

		console.log("Checking for subscription ID" + subscription.id);
		const states = await RepoSyncState.findAllFromSubscription(subscription);
		expect(states.length).toBe(2);
	}

	it("Discovery sqs queue processes the message", async () => {
		githubAccessTokenNock(installationId);
		await sqsQueues.discovery.sendMessage({ installationId: installationId, jiraHost });
		await waitUntil(async () => verify2RepositoriesInTheStateAndBackfillMessageSent());
	});

	it("Discovery queue message handler works correctly", async () => {
		// githubAccessTokenNock(installationId);
		await discovery(app)({ data: { installationId: installationId, jiraHost } }, getLogger("test"));
		await verify2RepositoriesInTheStateAndBackfillMessageSent();
	});
});

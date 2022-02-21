import { Installation, RepoSyncState, Subscription } from "../../src/models";
import { sqsQueues } from "../../src/sqs/queues";
import { createWebhookApp } from "../utils/probot";
import app from "../../src/worker/app";
import { discovery } from "../../src/sync/discovery";
import { getLogger } from "../../src/config/logger";
import waitUntil from "../utils/waitUntil";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "../../src/config/feature-flags";

jest.mock("../../src/config/feature-flags");

const mockGitHubClientResponse = {
	"data": {
		"viewer": {
			"repositories": {
				"pageInfo": {
					"endCursor": "Y3Vyccccc353OnYyOpHOGyQXZg==",
					"hasNextPage": false
				},
				"edges": [{
					"node": {
						"id": 222222,
						"name": "test-repo",
						"full_name": "myrepo/test-repo",
						"owner": {
							"login": "myrepo"
						},
						"html_url": "https://github.com/myrepo/test-repo",
						"updated_at": "2014-09-22T11:16:46.000Z"
					}
				},
				{
					"node": {
						"id": 9999999,
						"name": "deployment-test",
						"full_name": "myrepo/deployment-test",
						"owner": {
							"login": "myrepo"
						},
						"html_url": "https://github.com/myrepo/deployment-test",
						"updated_at": "2022-02-03T22:31:15.000Z"
					}
				}
				]
			}
		}
	}
}

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
		await discovery(app)({ data: { installationId: TEST_INSTALLATION_ID, jiraHost } }, getLogger("test"));
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
		githubNock
			.post("/graphql")
			.reply(200, mockGitHubClientResponse);
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
		await discovery(app)({ data: { installationId: TEST_INSTALLATION_ID, jiraHost } }, getLogger("test"));
		await verify2RepositoriesInTheStateAndBackfillMessageSent();
	});
});

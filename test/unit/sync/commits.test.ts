/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
// import { removeInterceptor } from "nock";
// import { commitsNoLastCursor, getDefaultBranch } from "../../fixtures/api/graphql/commit-queries";
// import { commitsWithLastCursor, getDefaultBranch } from "../../fixtures/api/graphql/commit-queries";
import { processInstallation } from "../../../src/sync/installation";
import { Installation, RepoSyncState, Subscription } from "../../../src/models";
import { mocked } from "ts-jest/utils";
import { Application } from "probot";
import { createWebhookApp } from "../../utils/probot";
import { sqsQueues } from "../../../src/sqs/queues";
import { getLogger } from "../../../src/config/logger";
// import { Hub } from "@sentry/types/dist/hub";
import { BackfillMessagePayload } from "../../../src/sqs/backfill";
// import { branchesNoLastCursor } from "../../fixtures/api/graphql/branch-queries";

jest.mock("../../../src/sqs/queues");

describe("sync/commits", () => {
	const installationId = 1234;
	let app: Application;

	const defaultBranchFixture = require("../../fixtures/api/graphql/default-branch.json");
	const commitNodesFixture = require("../../fixtures/api/graphql/commit-nodes.json");
	// const mixedCommitNodes = require("../../fixtures/api/graphql/commit-nodes-mixed.json");
	// const defaultBranchNullFixture = require("../../fixtures/api/graphql/default-branch-null.json");
	// const commitsNoKeys = require("../../fixtures/api/graphql/commit-nodes-no-keys.json");

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	const sentry: Hub = { setUser: jest.fn() } as any;
	const mockBackfillQueueSendMessage = mocked(sqsQueues.backfill.sendMessage);

	// TODO THIS IS ONLY VALID FOR 1 TEST
	const makeExpectedResponse = () => ({
		preventTransitions: true,
		repositories: [
			{
				"commits": [
					{
						"author": {
							"name": "test-author-name",
							"email": "test-author-email@example.com"
						},
						"authorTimestamp": "test-authored-date",
						"displayId": "test-o",
						"fileCount": 0,
						"hash": "test-oid",
						"id": "test-oid",
						"issueKeys": [
							"TES-17"
						],
						"message": "[TES-17] test-commit-message",
						"url": "https://github.com/test-login/test-repo/commit/test-sha",
						"updateSequenceId": 12345678
					}
				],
				"id": "1",
				"name": "test-repo-name",
				"url": "test-repo-url",
				"updateSequenceId": 12345678
			}
		],
		properties: {
			"installationId": 1234
		}
	});


	// const getCommitsQuery = () => {
	// 	return commitsNoLastCursor({
	// 		owner: "integrations", 
	// 		repo: "test-repo-name", 
	// 		per_page: 20, 
	// 		default_ref: "master"
	// 	});
	// }


	// need a syncstate obj
	beforeEach(async () => {
		app = await createWebhookApp();

		mockSystemTime(12345678);

		await Installation.create({
			gitHubInstallationId: installationId,
			jiraHost,
			sharedSecret: "secret",
			clientKey: "client-key"
		});

		const subscription = await Subscription.create({
			gitHubInstallationId: installationId,
			jiraHost,
			syncStatus: "ACTIVE"
		});

		await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: 1,
			repoName: "test-repo-name",
			repoOwner: "integrations",
			repoFullName: "test-repo-name",
			repoUrl: "test-repo-url",
			branchStatus: "complete", 
			commitStatus: "pending", // Want next process to be commits
			pullStatus: "complete",
			updatedAt: new Date(),
			createdAt: new Date()
		});

		mocked(sqsQueues.backfill.sendMessage).mockResolvedValue(Promise.resolve());

		// if (useNewGithubClient) {
		// 	githubAccessTokenNock(installationId);
		// }
	});


	const verifyMessageSent = (data: BackfillMessagePayload, delaySec ?: number) => {
		expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(1);
		expect(mockBackfillQueueSendMessage.mock.calls[0][0]).toEqual(data);
		expect(mockBackfillQueueSendMessage.mock.calls[0][1]).toEqual(delaySec || 0);
	};
	

	it("should sync to Jira when Commit Nodes have jira references 2", async () => {
		expect(1).toEqual(1);
	});


	it("should sync to Jira when Commit Nodes have jira references", async () => {
		const data = { installationId, jiraHost };

		githubNock
			.post("/graphql")
			.reply(200, defaultBranchFixture)
			.post("/graphql")
			.reply(200, commitNodesFixture)

		jiraNock
			.post(
				"/rest/devinfo/0.10/bulk",
				makeExpectedResponse() // todo rename this generic if applicable
			)
			.reply(200);

		await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
		verifyMessageSent(data);
	});
	

	// it.skip("should send Jira all commits that have Issue Keys", async () => {
	// 	const data = { installationId, jiraHost };

	// 	githubNock
	// 		.post("/graphql", getDefaultBranch)
	// 		.query(true)
	// 		.reply(200, defaultBranchFixture)
	// 		.post("/graphql", getCommitsQuery())
	// 		.query(true)
	// 		.reply(200, mixedCommitNodes)

	// 	jiraNock.post("/rest/devinfo/0.10/bulk", {
	// 		preventTransitions: true,
	// 		repositories: [
	// 			{
	// 				"commits": [
	// 					{
	// 						"author": {
	// 							"name": "test-author-name",
	// 							"email": "test-author-email@example.com"
	// 						},
	// 						"authorTimestamp": "test-authored-date",
	// 						"displayId": "test-o",
	// 						"fileCount": 3,
	// 						"hash": "test-oid-1",
	// 						"id": "test-oid-1",
	// 						"issueKeys": [
	// 							"TES-17"
	// 						],
	// 						"message": "[TES-17] test-commit-message",
	// 						"url": "https://github.com/test-login/test-repo/commit/test-sha",
	// 						"updateSequenceId": 12345678
	// 					},
	// 					{
	// 						"author": {
	// 							"avatar": "test-avatar-url",
	// 							"name": "test-author-name",
	// 							"email": "test-author-email@example.com"
	// 						},
	// 						"authorTimestamp": "test-authored-date",
	// 						"displayId": "test-o",
	// 						"fileCount": 0,
	// 						"hash": "test-oid-2",
	// 						"id": "test-oid-2",
	// 						"issueKeys": [
	// 							"TES-15"
	// 						],
	// 						"message": "[TES-15] another test-commit-message",
	// 						"url": "https://github.com/test-login/test-repo/commit/test-sha",
	// 						"updateSequenceId": 12345678
	// 					},
	// 					{
	// 						"author": {
	// 							"avatar": "test-avatar-url",
	// 							"name": "test-author-name",
	// 							"email": "test-author-email@example.com"
	// 						},
	// 						"authorTimestamp": "test-authored-date",
	// 						"displayId": "test-o",
	// 						"fileCount": 0,
	// 						"hash": "test-oid-3",
	// 						"id": "test-oid-3",
	// 						"issueKeys": [
	// 							"TES-14",
	// 							"TES-15"
	// 						],
	// 						"message": "TES-14-TES-15 message with multiple keys",
	// 						"url": "https://github.com/test-login/test-repo/commit/test-sha",
	// 						"updateSequenceId": 12345678
	// 					}
	// 				],
	// 				"id": "1",
	// 				"name": "test-repo-name",
	// 				"url": "test-repo-url",
	// 				"updateSequenceId": 12345678
	// 			}
	// 		],
	// 		properties: {
	// 			installationId: 1234
	// 		}
	// 	}).reply(200);

	// 	await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
	// 	verifyMessageSent(data);
	// });

	// it.skip("should default to master branch if defaultBranchRef is null", async () => {
	// 	const data = { installationId, jiraHost };

	// 	githubNock
	// 		.post("/graphql", getDefaultBranch)
	// 		.reply(200, defaultBranchNullFixture)
	// 		.post("/graphql", getCommitsQuery())
	// 		.reply(200, commitNodesFixture)

	// 	jiraNock.post("/rest/devinfo/0.10/bulk", {
	// 		preventTransitions: true,
	// 		repositories: [
	// 			{
	// 				"commits": [
	// 					{
	// 						"author": {
	// 							"name": "test-author-name",
	// 							"email": "test-author-email@example.com"
	// 						},
	// 						"authorTimestamp": "test-authored-date",
	// 						"displayId": "test-o",
	// 						"fileCount": 0,
	// 						"hash": "test-oid",
	// 						"id": "test-oid",
	// 						"issueKeys": [
	// 							"TES-17"
	// 						],
	// 						"message": "[TES-17] test-commit-message",
	// 						"url": "https://github.com/test-login/test-repo/commit/test-sha",
	// 						"updateSequenceId": 12345678
	// 					}
	// 				],
	// 				"id": "1",
	// 				"name": "test-repo-name",
	// 				"url": "test-repo-url",
	// 				"updateSequenceId": 12345678
	// 			}
	// 		],
	// 		properties: {
	// 			installationId: 1234
	// 		}
	// 	}).reply(200);

	// 	await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
	// 	verifyMessageSent(data);
	// });

	// it.skip("should not call Jira if no issue keys are present", async () => {
	// 	const data = { installationId, jiraHost };

	// 	githubNock
	// 		.post("/graphql", getDefaultBranch)
	// 		.reply(200, defaultBranchFixture)
	// 		.post("/graphql", getCommitsQuery())
	// 		.reply(200, commitsNoKeys)

	// 	const interceptor = jiraNock.post(/.*/);
	// 	const scope = interceptor.reply(200);

	// 	await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
	// 	expect(scope).not.toBeDone();
	// 	removeInterceptor(interceptor);
	// });

	// it("should not call Jira if no data is returned", async () => {
	// 	// const data = { installationId, jiraHost };
	// 	// githubNock
	// 	// 	.post("/graphql", getDefaultBranch)
	// 	// 	.reply(200, defaultBranchFixture)
	// 	// 	.post("/graphql", getCommitsQuery())
	// 	// 	.reply(200)

	// 	// const interceptor = jiraNock.post(/.*/);
	// 	// const scope = interceptor.reply(200);

	// 	// await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
	// 	// expect(scope).not.toBeDone();
	// 	// removeInterceptor(interceptor);
	// });


});
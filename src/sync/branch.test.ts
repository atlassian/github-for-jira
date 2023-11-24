import { branchesNoLastCursor } from "fixtures/api/graphql/branch-queries";
import { processInstallation } from "./installation";
import { getLogger } from "config/logger";
import { cleanAll } from "nock";
import { Hub } from "@sentry/types/dist/hub";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import branchNodesFixture from "fixtures/api/graphql/branch-ref-nodes.json";

import branchCommitsHaveKeys from "fixtures/api/graphql/branch-commits-have-keys.json";

import associatedPRhasKeys from "fixtures/api/graphql/branch-associated-pr-has-keys.json";

import branchNoIssueKeys from "fixtures/api/graphql/branch-no-issue-keys.json";
import { jiraIssueKeyParser } from "utils/jira-utils";
import { waitUntil } from "test/utils/wait-until";
import { GitHubServerApp } from "models/github-server-app";
import { DatabaseStateCreator, CreatorResult } from "test/utils/database-state-creator";

const lastMockedDevInfoRepoUpdateFn = jest.fn();
jest.mock("../jira/client/jira-client", () => ({
	getJiraClient: async (...args) => {
		const actual = await jest.requireActual("../jira/client/jira-client").getJiraClient(...args);
		return {
			...actual,
			devinfo: {
				...actual.devinfo,
				repository: {
					...actual.devinfo.repository,
					update: (...repoArgs) => {
						lastMockedDevInfoRepoUpdateFn(...repoArgs);
						return actual.devinfo.repository.update(...repoArgs);
					}
				}
			}
		};
	}
}));

describe("sync/branches", () => {

	/* eslint-disable @typescript-eslint/no-explicit-any */
	const sentry: Hub = { setUser: jest.fn() } as any;
	const MOCK_SYSTEM_TIMESTAMP_SEC = 12345678;

	beforeEach(() => {
		mockSystemTime(MOCK_SYSTEM_TIMESTAMP_SEC);
	});

	const makeExpectedResponseCloudServer = (branchName: string, repoId: string) => ({
		preventTransitions: true,
		operationType: "BACKFILL",
		repositories: [
			{
				branches: [
					{
						createPullRequestUrl: `test-repo-url/compare/${branchName}?title=TES-123-${branchName}&quick_pull=1`,
						id: branchName,
						issueKeys: ["TES-123"]
							.concat(jiraIssueKeyParser(branchName))
							.reverse()
							.filter((key) => !!key),
						lastCommit: {
							author: {
								avatar: "https://camo.githubusercontent.com/test-avatar",
								email: "test-author-email@example.com",
								name: "test-author-name"
							},
							authorTimestamp: "test-authored-date",
							displayId: "test-o",
							fileCount: 0,
							hash: "test-oid",
							id: "test-oid",
							issueKeys: ["TES-123"],
							message: "TES-123 test-commit-message",
							url: "test-repo-url/commit/test-sha",
							updateSequenceId: 12345678
						},
						name: branchName,
						url: `test-repo-url/tree/${branchName}`,
						updateSequenceId: 12345678
					}
				],
				commits: [
					{
						author: {
							avatar: "https://camo.githubusercontent.com/test-avatar",
							email: "test-author-email@example.com",
							name: "test-author-name"
						},
						authorTimestamp: "test-authored-date",
						displayId: "test-o",
						fileCount: 0,
						hash: "test-oid",
						id: "test-oid",
						issueKeys: ["TES-123"],
						message: "TES-123 test-commit-message",
						timestamp: "test-authored-date",
						url: "test-repo-url/commit/test-sha",
						updateSequenceId: 12345678
					}
				],
				id: repoId,
				name: "test-repo-name",
				url: "test-repo-url",
				updateSequenceId: 12345678
			}
		],
		properties: {
			installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID
		}
	});

	describe("cloud", () => {

		const makeExpectedResponse = (branchName: string) => {
			return makeExpectedResponseCloudServer(branchName, "1");
		};

		const nockBranchRequest = (response: object, variables?: Record<string, unknown>) =>
			githubNock
				.post("/graphql", branchesNoLastCursor(variables))
				.query(true)
				.reply(200, response);

		const mockBackfillQueueSendMessage = jest.fn();

		let db: CreatorResult;
		beforeEach(async () => {

			db = await new DatabaseStateCreator()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForBranches()
				.create();

			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

		});

		const verifyMessageSent = async (data: BackfillMessagePayload, delaySec?: number) => {
			await waitUntil(async () => {
				expect(githubNock).toBeDone();
				expect(jiraNock).toBeDone();
			});
			expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(1);
			expect(mockBackfillQueueSendMessage.mock.calls[0][0]).toEqual(data);
			expect(mockBackfillQueueSendMessage.mock.calls[0][1]).toEqual(delaySec || 0);
		};

		it("should sync to Jira when branch refs have jira references", async () => {

			const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			nockBranchRequest(branchNodesFixture);

			jiraNock
				.post(
					"/rest/devinfo/0.10/bulk",
					makeExpectedResponse("branch-with-issue-key-in-the-last-commit")
				)
				.reply(200);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);

			expect(lastMockedDevInfoRepoUpdateFn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
				auditLogsource: "BACKFILL",
				entityAction: "BRANCH",
				subscriptionId: db.subscription.id
			}));

		});

		it("should send data if issue keys are only present in commits", async () => {
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			nockBranchRequest(branchCommitsHaveKeys);

			jiraNock
				.post(
					"/rest/devinfo/0.10/bulk",
					makeExpectedResponse("dev")
				)
				.reply(200);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should send data if issue keys are only present in an associated PR title", async () => {
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			nockBranchRequest(associatedPRhasKeys);

			jiraNock
				.post("/rest/devinfo/0.10/bulk", {
					preventTransitions: true,
					operationType: "BACKFILL",
					repositories: [
						{
							branches: [
								{
									createPullRequestUrl: "test-repo-url/compare/dev?title=PULL-123-dev&quick_pull=1",
									id: "dev",
									issueKeys: ["PULL-123"],
									lastCommit: {
										author: {
											avatar: "https://camo.githubusercontent.com/test-avatar",
											email: "test-author-email@example.com",
											name: "test-author-name"
										},
										authorTimestamp: "test-authored-date",
										displayId: "test-o",
										fileCount: 0,
										hash: "test-oid",
										issueKeys: [],
										id: "test-oid",
										message: "test-commit-message",
										url: "test-repo-url/commit/test-sha",
										updateSequenceId: 12345678
									},
									name: "dev",
									url: "test-repo-url/tree/dev",
									updateSequenceId: 12345678
								}
							],
							commits: [],
							id: "1",
							name: "test-repo-name",
							url: "test-repo-url",
							updateSequenceId: 12345678
						}
					],
					properties: {
						installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID
					}
				})
				.reply(200);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should not call Jira if no issue keys are found", async () => {
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			nockBranchRequest(branchNoIssueKeys);

			jiraNock.post(/.*/).reply(200);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			expect(jiraNock).not.toBeDone();
			cleanAll();
			await verifyMessageSent(data);
		});

		describe("Branch sync date", () => {
			describe("Branch commit history value is passed", () => {

				it("should use commit history depth parameter before feature flag time", async () => {
					const time = Date.now();
					const commitTimeLimitCutoff = 1000 * 60 * 60 * 96;
					mockSystemTime(time);
					const commitsFromDate = new Date(time - commitTimeLimitCutoff).toISOString();
					const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, commitsFromDate };

					nockBranchRequest(branchNodesFixture, { commitSince: commitsFromDate });
					jiraNock
						.post(
							"/rest/devinfo/0.10/bulk",
							makeExpectedResponse("branch-with-issue-key-in-the-last-commit")
						)
						.reply(200);

					await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
					await verifyMessageSent(data);
				});
			});
		});
	});

	describe("server", () => {
		let gitHubServerApp: GitHubServerApp;

		const nockBranchRequest = (response: object, variables?: Record<string, unknown>) =>
			gheNock
				.post("/api/graphql", branchesNoLastCursor(variables))
				.query(true)
				.reply(200, response);

		beforeEach(async () => {

			const builderResult = await new DatabaseStateCreator()
				.forServer()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForBranches()
				.create();
			gitHubServerApp = builderResult.gitHubServerApp!;

			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		});

		const makeExpectedResponse = async (branchName: string) => {
			return makeExpectedResponseCloudServer(branchName, "6769746875626d79646f6d61696e636f6d-1");
		};

		it("should sync to Jira when branch refs have jira references", async () => {
			const data: BackfillMessagePayload = {
				installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
				jiraHost,
				gitHubAppConfig: {
					uuid: gitHubServerApp.uuid,
					gitHubAppId: gitHubServerApp.id,
					appId: gitHubServerApp.appId,
					clientId: gitHubServerApp.gitHubClientId,
					gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
					gitHubApiUrl: gitHubServerApp.gitHubBaseUrl + "/v3/api"
				}
			};

			nockBranchRequest(branchNodesFixture);

			jiraNock
				.post(
					"/rest/devinfo/0.10/bulk",
					await makeExpectedResponse("branch-with-issue-key-in-the-last-commit")
				)
				.reply(200);

			await expect(processInstallation(jest.fn())(data, sentry, getLogger("test"))).toResolve();
		});
	});
});

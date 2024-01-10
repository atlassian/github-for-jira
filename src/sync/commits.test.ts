/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { removeInterceptor } from "nock";
import { processInstallation } from "./installation";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import commitNodesFixture from "fixtures/api/graphql/commit-nodes.json";
import mixedCommitNodes from "fixtures/api/graphql/commit-nodes-mixed.json";
import commitsNoKeys from "fixtures/api/graphql/commit-nodes-no-keys.json";
import { getCommitsQueryWithChangedFiles } from "~/src/github/client/github-queries";
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

describe("sync/commits", () => {
	const sentry: Hub = { setUser: jest.fn() } as any;

	beforeEach(() => {
		mockSystemTime(12345678);
		lastMockedDevInfoRepoUpdateFn && lastMockedDevInfoRepoUpdateFn.mockReset();
	});

	describe("for cloud", () => {
		const mockBackfillQueueSendMessage = jest.fn();

		const makeExpectedJiraResponse = (commits) => ({
			preventTransitions: true,
			operationType: "BACKFILL",
			repositories: [
				{
					commits,
					"id": "1",
					"name": "test-repo-name",
					"url": "test-repo-url",
					"updateSequenceId": 12345678
				}
			],
			properties: {
				"installationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID
			}
		});

		const createGitHubNock = (commitsResponse, variables?: Record<string, any>) => {
			githubNock
				.post("/graphql", {
					query: getCommitsQueryWithChangedFiles,
					variables: {
						owner: "integrations",
						repo: "test-repo-name",
						per_page: 20,
						...variables
					}
				})
				.query(true)
				.reply(200, commitsResponse);
		};

		const createJiraNock = (commits) => {
			jiraNock
				.post("/rest/devinfo/0.10/bulk", makeExpectedJiraResponse(commits))
				.reply(200);
		};

		let db: CreatorResult;
		beforeEach(async () => {
			db = await new DatabaseStateCreator()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForCommits()
				.create();

			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		});

		const verifyMessageSent = async (data: BackfillMessagePayload, delaySec ?: number) => {
			await waitUntil(async () => {
				expect(githubNock).toBeDone();
				expect(jiraNock).toBeDone();
			});
			expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(1);
			expect(mockBackfillQueueSendMessage.mock.calls[0][0]).toEqual(data);
			expect(mockBackfillQueueSendMessage.mock.calls[0][1]).toEqual(delaySec || 0);
		};

		it("should sync to Jira when Commit Nodes have jira references", async () => {

			const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

			createGitHubNock(commitNodesFixture);
			const commits = [
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
			];
			createJiraNock(commits);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);

			expect(lastMockedDevInfoRepoUpdateFn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
				auditLogsource: "BACKFILL",
				entityAction: "COMMIT",
				subscriptionId: db.subscription.id
			}));
		});

		it("should send Jira all commits that have Issue Keys", async () => {
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

			createGitHubNock(mixedCommitNodes);

			const commits = [
				{
					"author": {
						"name": "test-author-name",
						"email": "test-author-email@example.com"
					},
					"authorTimestamp": "test-authored-date",
					"displayId": "test-o",
					"fileCount": 3,
					"hash": "test-oid-1",
					"id": "test-oid-1",
					"issueKeys": [
						"TES-17"
					],
					"message": "[TES-17] test-commit-message",
					"url": "https://github.com/test-login/test-repo/commit/test-sha",
					"updateSequenceId": 12345678
				},
				{
					"author": {
						"avatar": "test-avatar-url",
						"name": "test-author-name",
						"email": "test-author-email@example.com"
					},
					"authorTimestamp": "test-authored-date",
					"displayId": "test-o",
					"fileCount": 0,
					"hash": "test-oid-2",
					"id": "test-oid-2",
					"issueKeys": [
						"TES-15"
					],
					"message": "[TES-15] another test-commit-message",
					"url": "https://github.com/test-login/test-repo/commit/test-sha",
					"updateSequenceId": 12345678
				},
				{
					"author": {
						"avatar": "test-avatar-url",
						"name": "test-author-name",
						"email": "test-author-email@example.com"
					},
					"authorTimestamp": "test-authored-date",
					"displayId": "test-o",
					"fileCount": 0,
					"hash": "test-oid-3",
					"id": "test-oid-3",
					"issueKeys": [
						"TES-14",
						"TES-15"
					],
					"message": "TES-14-TES-15 message with multiple keys",
					"url": "https://github.com/test-login/test-repo/commit/test-sha",
					"updateSequenceId": 12345678
				}
			];
			createJiraNock(commits);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should not call Jira if no issue keys are present", async () => {
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

			createGitHubNock(commitsNoKeys);

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			expect(scope).not.toBeDone();
			removeInterceptor(interceptor);
		});

		it("should not call Jira if no data is returned", async () => {
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			createGitHubNock(commitsNoKeys);

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			expect(scope).not.toBeDone();
			removeInterceptor(interceptor);
		});

	});

	describe("for server",  () => {

		const createGitHubENock = (commitsResponse, variables?: Record<string, any>) => {
			gheNock
				.post("/api/graphql", {
					query: getCommitsQueryWithChangedFiles,
					variables: {
						owner: "integrations",
						repo: "test-repo-name",
						per_page: 20,
						...variables
					}
				})
				.query(true)
				.reply(200, commitsResponse);
		};

		let gitHubServerApp: GitHubServerApp;

		beforeEach(async () => {

			const builderResult = await new DatabaseStateCreator()
				.forServer()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForCommits()
				.create();
			gitHubServerApp = builderResult.gitHubServerApp!;

			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		});

		const makeExpectedJiraResponse = async (commits) => ({
			preventTransitions: true,
			operationType: "BACKFILL",
			repositories: [
				{
					commits,
					"id": "6769746875626d79646f6d61696e636f6d-1",
					"name": "test-repo-name",
					"url": "test-repo-url",
					"updateSequenceId": 12345678
				}
			],
			properties: {
				"installationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID
			}
		});

		const createJiraNock = async (commits) => {
			jiraNock
				.post("/rest/devinfo/0.10/bulk", await makeExpectedJiraResponse(commits))
				.reply(200);
		};

		it("should sync to Jira when Commit Nodes have jira references", async () => {

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

			createGitHubENock(commitNodesFixture);
			const commits = [
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
			];
			await createJiraNock(commits);

			await expect(processInstallation(jest.fn())(data, sentry, getLogger("test"))).toResolve();
		});

	});
});

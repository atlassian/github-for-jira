import {
	getTargetTasks,
	isRetryableWithSmallerRequest, markCurrentTaskAsFailedAndContinue,
	processInstallation,
	TaskError, updateTaskStatusAndContinue
} from "~/src/sync/installation";
import { Task, TaskType } from "~/src/sync/sync.types";
import { DeduplicatorResult } from "~/src/sync/deduplicator";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import { Repository, Subscription, SyncStatus } from "models/subscription";
import { v4 as UUID } from "uuid";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { RepoSyncState } from "models/reposyncstate";
import { branchesNoLastCursor } from "fixtures/api/graphql/branch-queries";
import branchNodesFixture from "fixtures/api/graphql/branch-ref-nodes.json";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { JiraClientError } from "~/src/jira/client/axios";
import { when } from "jest-when";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { GithubClientNotFoundError } from "~/src/github/client/github-client-errors";
import { cloneDeep } from "lodash";

jest.mock("config/feature-flags");

let dedupCallThrough = false;
const mockedExecuteWithDeduplication = jest.fn().mockResolvedValue(DeduplicatorResult.E_OK);
jest.mock("~/src/sync/deduplicator", () => ({
	...jest.requireActual("~/src/sync/deduplicator"),
	Deduplicator: function() {
		return {
			executeWithDeduplication: (jobId, execution) => {
				if (dedupCallThrough){
					return execution().then(() => DeduplicatorResult.E_OK);
				} else {
					return mockedExecuteWithDeduplication(jobId, execution);
				}
			}
		};
	}
}));

const configureRateLimit = (coreQuotaRemainig: number, graphQlQuotaRemaining: number) => {
	githubNock
		.persist()
		.get(`/rate_limit`)
		.reply(200, {
			"resources": {
				"core": {
					"limit": coreQuotaRemainig * 10,
					"remaining": coreQuotaRemainig
				},
				"graphql": {
					"limit": graphQlQuotaRemaining * 10,
					"remaining": graphQlQuotaRemaining
				}
			}
		});
};

describe("sync/installation", () => {

	let MESSAGE_PAYLOAD;
	let MESSAGE_PAYLOAD_GHE;
	let repoSyncState: RepoSyncState;
	let subscription: Subscription | null;

	const TEST_LOGGER = getLogger("test");
	const GITHUB_APP_ID = 123;

	const TEST_REPO: Repository = {
		id: 123,
		name: "Test",
		full_name: "Test/Test",
		owner: { login: "test" },
		html_url: "https://test",
		updated_at: "1234"
	};

	const TASK: Task = { task: "branch", repositoryId: 123, repository: TEST_REPO };

	beforeEach(async () => {
		dedupCallThrough = false;
		const res = await new DatabaseStateCreator()
			.withActiveRepoSyncState()
			.repoSyncStatePendingForBranches()
			.repoSyncStatePendingForCommits()
			.create();
		repoSyncState = res.repoSyncState!;
		subscription = res.subscription;

		TASK.repositoryId = repoSyncState.repoId;

		MESSAGE_PAYLOAD = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
		MESSAGE_PAYLOAD_GHE = {
			installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
			jiraHost,
			gitHubAppConfig: {
				gitHubAppId: GITHUB_APP_ID,
				appId: 2,
				clientId: "client_id",
				gitHubBaseUrl: "http://ghes.server",
				gitHubApiUrl: "http://ghes.server",
				uuid: UUID()
			}
		};

		when(numberFlag).calledWith(
			NumberFlags.BACKFILL_PAGE_SIZE,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(20);
	});

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-expect-error
	const sentry: Hub = { setUser: jest.fn() } as Hub;

	describe("isRetryableWithSmallerRequest()", () => {
		it("should return false for error without isRetryable flag", () => {
			const err = {
				errors: [
					{
						type: "FOO"
					}
				]
			};

			expect(isRetryableWithSmallerRequest(err)).toBeFalsy();
		});

		it("should return true for error with isRetryable flag", () => {
			const err = {
				isRetryable: true,
				errors: [
					{
						type: "FOO"
					}
				]
			};

			expect(isRetryableWithSmallerRequest(err)).toBeTruthy();
		});
	});

	describe("processInstallation", () => {

		it("should process the installation with deduplication for cloud", async () => {
			await processInstallation(jest.fn())(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
			expect(mockedExecuteWithDeduplication.mock.calls.length).toBe(1);
			expect(mockedExecuteWithDeduplication).toBeCalledWith(`i-${DatabaseStateCreator.GITHUB_INSTALLATION_ID}-${jiraHost}-ghaid-cloud`, expect.anything());
		});

		it("should process the installation with deduplication for GHES", async () => {
			const sendSqsMessage = jest.fn();
			await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD_GHE, sentry, TEST_LOGGER);
			expect(mockedExecuteWithDeduplication.mock.calls.length).toBe(1);
			expect(mockedExecuteWithDeduplication).toBeCalledWith(`i-${DatabaseStateCreator.GITHUB_INSTALLATION_ID}-${jiraHost}-ghaid-${GITHUB_APP_ID}`, expect.anything());
		});

		it("should reschedule the job if deduplicator is unsure", async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER);
			const sendSqsMessage = jest.fn();
			await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
			expect(sendSqsMessage).toBeCalledTimes(1);
			expect(sendSqsMessage).toBeCalledWith(MESSAGE_PAYLOAD, 60, expect.anything());
		});

		it("should also reschedule the job if deduplicator is sure", async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_OTHER_WORKER_DOING_THIS_JOB);
			const sendSqsMessage = jest.fn();
			await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
			expect(sendSqsMessage).toBeCalledTimes(1);
		});

		it("should rethrow errors", async () => {
			mockedExecuteWithDeduplication.mockRejectedValue(new Error(":haha:"));
			const sendSqsMessage = jest.fn();
			let err;
			try {
				await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
			} catch (caught) {
				err = caught;
			}
			expect(err.message).toEqual(":haha:");
		});

		it("should mark subscription as successful when no other tasks left", async () => {
			await repoSyncState.destroy();
			const sendSqsMessage = jest.fn();

			await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
			await mockedExecuteWithDeduplication.mock.calls[0][1]();

			expect((await Subscription.findByPk(subscription?.id))?.syncStatus).toEqual(SyncStatus.COMPLETE);
		});

		describe("with scheduler", () => {
			beforeEach(async () => {
				await configureRateLimit(10, 10); // no subtasks by default, please
			});

			it("should update cursor and continue sync", async () => {
				const sendSqsMessage = jest.fn();
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock
					.post("/graphql", branchesNoLastCursor())
					.query(true)
					.reply(200, branchNodesFixture);
				jiraNock.post("/rest/devinfo/0.10/bulk").reply(200);

				dedupCallThrough = true;
				await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);

				expect(sendSqsMessage).toBeCalledTimes(1);
				await repoSyncState.reload();
				expect(repoSyncState.branchCursor).toEqual("MQ");
				expect(repoSyncState.branchStatus).toEqual("pending");
			});

			it("should mark task as finished and continue sync", async () => {
				const sendSqsMessage = jest.fn();
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				const fixture = cloneDeep(branchNodesFixture);
				fixture.data.repository.refs.edges = [];
				githubNock
					.post("/graphql", branchesNoLastCursor())
					.query(true)
					.reply(200, fixture);

				dedupCallThrough = true;
				await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);

				expect(sendSqsMessage).toBeCalledTimes(1);
				await repoSyncState.reload();
				expect(repoSyncState.branchStatus).toEqual("complete");
			});

			it("should use page size from FF", async () => {
				when(numberFlag).calledWith(
					NumberFlags.BACKFILL_PAGE_SIZE,
					expect.anything(),
					expect.anything()
				).mockResolvedValue(90);

				const sendSqsMessage = jest.fn();
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				const query = branchesNoLastCursor();
				query.variables.per_page = 90;
				githubNock
					.post("/graphql", query)
					.query(true)
					.reply(200, branchNodesFixture);
				jiraNock.post("/rest/devinfo/0.10/bulk").reply(200);

				dedupCallThrough = true;
				await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);

				expect(sendSqsMessage).toBeCalledTimes(1);
			});

			it("should not allow page sizes larger than 100", async () => {
				when(numberFlag).calledWith(
					NumberFlags.BACKFILL_PAGE_SIZE,
					expect.anything(),
					expect.anything()
				).mockResolvedValue(120);

				const sendSqsMessage = jest.fn();
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				const query = branchesNoLastCursor();
				query.variables.per_page = 100;
				githubNock
					.post("/graphql", query)
					.query(true)
					.reply(200, branchNodesFixture);
				jiraNock.post("/rest/devinfo/0.10/bulk").reply(200);

				dedupCallThrough = true;
				await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);

				expect(sendSqsMessage).toBeCalledTimes(1);
			});

			it("should rethrow GitHubClient error", async () => {
				const sendSqsMessage = jest.fn();
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock
					.post("/graphql")
					.query(true)
					.reply(404, {});

				let err: TaskError;
				try {
					await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
					await mockedExecuteWithDeduplication.mock.calls[0][1]();
				} catch (caught) {
					err = caught;
				}
				expect(err!).toBeInstanceOf(TaskError);
				expect(err!.task.task).toEqual("branch");
				expect(err!.cause).toBeInstanceOf(GithubClientNotFoundError);
			});

			it("should rethrow Jira error", async () => {
				const sendSqsMessage = jest.fn();
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock
					.post("/graphql", branchesNoLastCursor())
					.query(true)
					.reply(200, branchNodesFixture);
				jiraNock.post("/rest/devinfo/0.10/bulk").reply(500);

				let err: TaskError;
				try {
					await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
					await mockedExecuteWithDeduplication.mock.calls[0][1]();

				} catch (caught) {
					err = caught;
				}
				expect(err!).toBeInstanceOf(TaskError);
				expect(err!.task.task).toEqual("branch");
				expect(err!.cause).toBeInstanceOf(JiraClientError);
			});
		});
	});

	describe("getTargetTasks", () => {
		it("should return all tasks if no target tasks present", async () => {
			expect(getTargetTasks()).toEqual(["pull", "branch", "commit", "build", "deployment", "dependabotAlert", "secretScanningAlert", "codeScanningAlert"]);
			expect(getTargetTasks([])).toEqual(["pull", "branch", "commit", "build", "deployment", "dependabotAlert", "secretScanningAlert", "codeScanningAlert"]);
		});

		it("should return single target task", async () => {
			expect(getTargetTasks(["pull"])).toEqual(["pull"]);
		});

		it("should return set of target tasks", async () => {
			expect(getTargetTasks(["pull", "commit"])).toEqual(["pull", "commit"]);
		});

		it("should return set of target tasks and filter out invalid values", async () => {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-expect-error
			expect(getTargetTasks(["pull", "commit", "cats"])).toEqual(["pull", "commit"]);
		});
	});

	describe("markCurrentTaskAsFailedAndContinue", () => {
		const mockError = new Error("Oh noes, An error occurred");

		describe("common", () => {
			it("does nothing when there's no subscription", async () => {
				const sendMessageMock = jest.fn();
				await markCurrentTaskAsFailedAndContinue({
					...MESSAGE_PAYLOAD,
					installationId: (MESSAGE_PAYLOAD.installationId as number) + 1
				}, TASK, false, sendMessageMock, getLogger("test"), mockError);

				const refreshedRepoSyncState = await RepoSyncState.findByPk(repoSyncState.id);
				const refreshedSubscription = await Subscription.findByPk(subscription?.id);
				expect(repoSyncState.get({ plain: true })).toStrictEqual(refreshedRepoSyncState?.get({ plain: true }));
				expect(refreshedSubscription?.get({ plain: true })).toStrictEqual(subscription?.get({ plain: true }));
				expect(sendMessageMock).toBeCalledTimes(0);
			});

			it("updates status in RepoSyncState table", async () => {
				await markCurrentTaskAsFailedAndContinue(MESSAGE_PAYLOAD, TASK, false, jest.fn(), getLogger("test"), mockError);

				const refreshedRepoSyncState = await RepoSyncState.findByPk(repoSyncState.id);
				const refreshedSubscription = await Subscription.findByPk(subscription?.id);
				expect(refreshedRepoSyncState?.branchStatus).toEqual("failed");
				expect(refreshedSubscription?.get({ plain: true })).toStrictEqual(subscription?.get({ plain: true }));
			});

			it("does not update cursor in RepoSyncState table", async () => {
				await markCurrentTaskAsFailedAndContinue(MESSAGE_PAYLOAD, TASK, false, jest.fn(), getLogger("test"), mockError);

				const refreshedRepoSyncState = await RepoSyncState.findByPk(repoSyncState.id);
				expect(refreshedRepoSyncState?.branchCursor).toEqual(repoSyncState.branchCursor);
			});

			it("schedules next message", async () => {
				const sendMessageMock = jest.fn();
				await markCurrentTaskAsFailedAndContinue(MESSAGE_PAYLOAD, TASK, false, sendMessageMock, getLogger("test"), mockError);

				expect(sendMessageMock).toBeCalledTimes(1);
			});

			it("sets up sync warning on permission error", async () => {
				const sendMessageMock = jest.fn();
				await markCurrentTaskAsFailedAndContinue(MESSAGE_PAYLOAD, TASK, true, sendMessageMock, getLogger("test"), mockError);

				const refreshedSubscription = await Subscription.findByPk(subscription?.id);
				expect(refreshedSubscription?.syncWarning).toEqual("Invalid permissions for branch task");
			});
		});

		// TODO: bgvozdev to finish off before enabling the FF for everyone
		describe("parallel sync", () => {
			let MESSAGE_PAYLOAD_BRANCHES_ONLY;

			beforeEach(async () => {
				MESSAGE_PAYLOAD_BRANCHES_ONLY = {
					...MESSAGE_PAYLOAD,
					targetTasks: ["branch"]
				};

				const	newRepoSyncStatesData: any[] = [];
				for (let newRepoStateNo = 1; newRepoStateNo < 50; newRepoStateNo++) {
					const newRepoSyncState = { ...repoSyncState.get() };
					delete newRepoSyncState["id"];
					delete newRepoSyncState["branchStatus"];
					newRepoSyncState["repoId"] = repoSyncState.repoId + newRepoStateNo;
					if (newRepoStateNo < 49) {
						// the last one should be main
						newRepoSyncState["repoName"] = repoSyncState.repoName + "_subtask";
						newRepoSyncState["repoFullName"] = repoSyncState.repoFullName + "_subtask";
					} else {
						newRepoSyncState["repoName"] = repoSyncState.repoName + "_main";
						newRepoSyncState["repoFullName"] = repoSyncState.repoFullName + "_main";
					}
					newRepoSyncStatesData.push(newRepoSyncState);
				}
				await RepoSyncState.bulkCreate(newRepoSyncStatesData);

				// That would give 2 tasks: one main and one subtask
				await configureRateLimit(1000, 1000);
			});

			it("for multiple tasks throws error only for the first one", async () => {
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

				const sendSqsMessage = jest.fn();
				dedupCallThrough = true;
				let capturedError;
				try {
					// Both tasks will fail because no nock was not setup
					await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD_BRANCHES_ONLY, sentry, TEST_LOGGER);
				} catch (err: unknown) {
					capturedError = err;
				}
				expect(capturedError).toBeInstanceOf(TaskError);
				expect((capturedError as TaskError).task.repository.full_name).toEqual("test-repo-name_main");
			});

			it("for multiple tasks updates cursors and schedules only one message", async () => {
				const sendSqsMessage = jest.fn();
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock
					.post("/graphql", branchesNoLastCursor({
						repo: "test-repo-name_main"
					}))
					.query(true)
					.reply(200, branchNodesFixture);

				githubNock
					.post("/graphql", branchesNoLastCursor({
						repo: "test-repo-name_subtask"
					}))
					.query(true)
					.reply(200, branchNodesFixture);

				jiraNock.post("/rest/devinfo/0.10/bulk").times(2).reply(200);

				dedupCallThrough = true;
				await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD_BRANCHES_ONLY, sentry, TEST_LOGGER);

				expect(sendSqsMessage).toBeCalledTimes(1);
				const updatedRows = await RepoSyncState.findAll({ where: {
					branchCursor: "MQ"
				} });
				expect(updatedRows.length).toEqual(2);
			});

			it("for multiple tasks ignores failures of non-main tasks", async () => {
				const sendSqsMessage = jest.fn();
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock
					.post("/graphql", branchesNoLastCursor({
						repo: "test-repo-name_main"
					}))
					.query(true)
					.reply(200, branchNodesFixture);

				githubNock
					.post("/graphql", branchesNoLastCursor({
						repo: "test-repo-name_subtask"
					}))
					.query(true)
					.reply(500);

				jiraNock.post("/rest/devinfo/0.10/bulk").reply(200);

				dedupCallThrough = true;
				await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD_BRANCHES_ONLY, sentry, TEST_LOGGER);

				expect(sendSqsMessage).toBeCalledTimes(1);
				const updatedRows = await RepoSyncState.findAll({ where: {
					branchCursor: "MQ"
				} });
				expect(updatedRows.length).toEqual(1);
			});
		});
	});

	describe("updateTaskStatusAndContinue", () => {
		const GITHUB_INSTALLATION_ID = 1111;
		const REPO_ID = 12345;
		const commitsFromDate = new Date();
		let data: BackfillMessagePayload;
		let sub: Subscription;
		let repoSync: RepoSyncState;

		const TEST_REPO: Repository = {
			id: REPO_ID,
			name: "Test",
			full_name: "Test/Test",
			owner: { login: "test" },
			html_url: "https://test",
			updated_at: "1234"
		};

		beforeEach(async ()=> {
			sub = await Subscription.install({ host: jiraHost, installationId: GITHUB_INSTALLATION_ID, gitHubAppId: undefined, hashedClientKey: "client-key" });
			repoSync = await RepoSyncState.create({
				subscriptionId: sub.id, repoId: REPO_ID, repoName: "name", repoUrl: "url", repoOwner: "owner", repoFullName: "full name",
				repoPushedAt: new Date(), repoUpdatedAt: new Date(), repoCreatedAt: new Date()
			});
			data = {
				installationId: GITHUB_INSTALLATION_ID,
				jiraHost: jiraHost,
				commitsFromDate: commitsFromDate.toISOString()
			};
		});

		it("should skip update backfill from date if task is branch", async () => {
			const task: Task = {
				task: "branch",
				repositoryId: REPO_ID,
				repository: TEST_REPO
			};
			await updateTaskStatusAndContinue(data, { edges: [], jiraPayload: undefined }, task, getLogger("test"), jest.fn());
			await repoSync.reload();
			expect(repoSync.branchFrom).toBeNull();
		});

		it("should skip update backfill from date if task is repository", async () => {
			const task: Task = {
				task: "repository",
				repositoryId: 0,
				repository: TEST_REPO
			};
			await updateTaskStatusAndContinue(data, { edges: [], jiraPayload: undefined }, task, getLogger("test"), jest.fn());
			await repoSync.reload();
			expect(repoSync.branchFrom).toBeNull();
			expect(repoSync.commitFrom).toBeNull();
			expect(repoSync.pullFrom).toBeNull();
			expect(repoSync.buildFrom).toBeNull();
			expect(repoSync.deploymentFrom).toBeNull();
			expect(repoSync.dependabotAlertFrom).toBeNull();
		});

		describe.each(
			["pull", "commit", "build", "deployment", "dependabotAlert", "secretScanningAlert", "codeScanningAlert"] as TaskType[]
		)("Update jobs status for each tasks", (taskType: TaskType) => {
			const colTaskFrom = `${taskType}From`;
			const task: Task = {
				task: taskType,
				repositoryId: REPO_ID,
				repository: TEST_REPO
			};
			it(`${taskType}: should update backfill from date upon success complete and existing backfill date is empty`, async () => {
				await updateTaskStatusAndContinue(data, { edges: [], jiraPayload: undefined }, task, getLogger("test"), jest.fn());
				await repoSync.reload();
				expect(repoSync[colTaskFrom]!.toISOString()).toEqual(commitsFromDate.toISOString());
			});
			it(`${taskType}: should update backfill from date upon success complete and new backfill date is earlier`, async () => {
				repoSync.pullFrom = new Date(commitsFromDate.getTime() + 100000);
				await repoSync.save();
				await updateTaskStatusAndContinue(data, { edges: [], jiraPayload: undefined }, task, getLogger("test"), jest.fn());
				await repoSync.reload();
				expect(repoSync[colTaskFrom]!.toISOString()).toEqual(commitsFromDate.toISOString());
			});
			it(`${taskType}: should skip update backfill from date upon success complete and new backfill date is more recent`, async () => {
				const oldDate = new Date(commitsFromDate.getTime() - 100000);
				repoSync[colTaskFrom]= oldDate;
				await repoSync.save();
				await updateTaskStatusAndContinue(data, { edges: [], jiraPayload: undefined }, task, getLogger("test"), jest.fn());
				await repoSync.reload();
				expect(repoSync[colTaskFrom]!.toISOString()).toEqual(oldDate.toISOString());
			});
			it(`${taskType}: should not update backfill from date is job is not complete`, async () => {
				await updateTaskStatusAndContinue(data, { edges: [ { cursor: "abcd" } ], jiraPayload: undefined }, task, getLogger("test"), jest.fn());
				await repoSync.reload();
				expect(repoSync.pullFrom).toBeNull();
			});
		});
	});

});

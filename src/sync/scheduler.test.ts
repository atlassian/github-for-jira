import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { getNextTasks } from "~/src/sync/scheduler";
import { Subscription } from "models/subscription";
import { getLogger } from "config/logger";
import { RepoSyncState } from "models/reposyncstate";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

jest.mock("config/feature-flags");

describe("scheduler", () => {

	let subscription: Subscription;
	beforeEach(async () => {
		const ret = await new DatabaseStateCreator().withActiveRepoSyncState().create();
		subscription = ret.subscription;
		const repoSyncState = ret.repoSyncState!;
		const newRepoSyncStatesData: any[] = [];
		for (let newRepoStateNo = 1; newRepoStateNo < 500; newRepoStateNo++) {
			const newRepoSyncState = { ...repoSyncState.get() };
			delete newRepoSyncState["id"];
			delete newRepoSyncState["commitStatus"];
			delete newRepoSyncState["branchStatus"];
			newRepoSyncState["repoId"] = repoSyncState.repoId + newRepoStateNo;
			newRepoSyncState["repoName"] = repoSyncState.repoName + newRepoStateNo;
			newRepoSyncState["repoFullName"] = repoSyncState.repoFullName + newRepoStateNo;
			newRepoSyncStatesData.push(newRepoSyncState);
		}
		await RepoSyncState.bulkCreate(newRepoSyncStatesData);

		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(false);
	});

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

	it("always returns repo task if not complete yet", async () => {
		subscription.repositoryStatus = undefined;
		const nextTasks = await getNextTasks(subscription, [], getLogger("test"));
		expect(nextTasks.mainTask!.task).toEqual("repository");
	});

	it("first (main) task is always same (deterministic), when FF off", async () => {
		const firstExecutionResult = await getNextTasks(subscription, [], getLogger("test"));

		for (let i = 0; i < 10; i++) {
			const nextExecutionResult = await getNextTasks(subscription, [], getLogger("test"));
			expect(nextExecutionResult).toEqual(firstExecutionResult);
		}
	});

	it("first (main) task is always same (deterministic), when FF on", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(10000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const firstTask = (await getNextTasks(subscription, [], getLogger("test")))[0];

		for (let i = 0; i < 10; i++) {
			const tasks = await getNextTasks(subscription, [], getLogger("test"));
			expect(tasks[0]).toEqual(firstTask);
		}
	});

	it("returns only main task when FF is off", async () => {
		const outcome = await getNextTasks(subscription, [], getLogger("test"));
		expect(outcome.mainTask).toBeDefined();
		expect(outcome.otherTasks.length).toEqual(0);
	});

	it("uses smallest quota between core and graphql to determine number of subtasks", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(100000, 2000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		// 2000 quota is for 4 tasks (500 reserved for each): 1 main task + 3 other tasks
		expect(tasks.mainTask).toBeDefined();
		expect(tasks.otherTasks.length).toEqual(3);
	});

	it("number of tasks never exceeds some limit", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(100000, 100000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		expect(tasks.mainTask).toBeDefined();
		// 100 is the max number of subtasks
		expect(tasks.otherTasks.length).toEqual(100);
	});

	it("does not blow up when quota is higher than available number of tasks", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(100000, 100000);

		const repoSyncStats = await RepoSyncState.findAllFromSubscription(subscription);
		await Promise.all(repoSyncStats.map((record, index) => {
			return index > 10 ? record.destroy() : Promise.resolve();
		}));

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		// We have 10 reposyncstate records, each holds 2 tasks
		expect(tasks.mainTask).toBeDefined();
		expect(tasks.otherTasks.length).toEqual(19);
	});

	it("shuffles the tail", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(10000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks1 = await getNextTasks(subscription, [], getLogger("test"));
		const tasks2 = await getNextTasks(subscription, [], getLogger("test"));
		expect(tasks1).not.toEqual(tasks2);
	});

	it("should return main task only when rate-limiting endpoint errors out", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		githubNock
			.persist()
			.get(`/rate_limit`)
			.reply(500);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		expect(tasks.mainTask).toBeDefined();
		expect(tasks.otherTasks.length).toEqual(0);
	});

	it("subtasks are picked only from tasks that would become main tasks soon", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(2000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		expect(tasks.mainTask?.repositoryId).toBeGreaterThan(100);
		tasks.otherTasks.forEach(task => {
			expect(task.repositoryId).toBeGreaterThan(100);
		});
	});

	it("all returned tasks are unique", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(10000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		const repoIdsAndTaskType = new Set<string>();
		tasks.otherTasks.forEach(task => {
			repoIdsAndTaskType.add("" + task.repositoryId + task.task);
		});
		repoIdsAndTaskType.add("" + tasks.mainTask!.repositoryId + tasks.mainTask!.task);
		expect(tasks.otherTasks.length + 1).toEqual(repoIdsAndTaskType.size);
	});

	it("all returned other tasks are within some pool", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(10000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const otherTasksAndTaskTypes = new Set<string>();
		for (let i = 0; i < 50; i++) {
			const tasks = await getNextTasks(subscription, [], getLogger("test"));
			tasks.otherTasks.forEach(task => {
				otherTasksAndTaskTypes.add("" + task.repositoryId);
			});
		}
		// The pool size should be 100:
		// 10000 / 500  = 20 - this is the number of subtasks
		// 20 * 10 (POOL_SIZE_COEF) = 200 - number of repos to fetch
		// each repo has 2 tasks, therefore only top 100 repos will be fetched
		expect(otherTasksAndTaskTypes.size).toBeGreaterThan(80);
		expect(otherTasksAndTaskTypes.size).toBeLessThan(101);
	});

	it("returns empty when all tasks are finished", async () => {
		const repoSyncStats = await RepoSyncState.findAllFromSubscription(subscription);
		await Promise.all(repoSyncStats.map((record) => {
			record.branchStatus = "complete";
			record.commitStatus = "complete";
			return record.save();
		}));

		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		expect(tasks).toStrictEqual({
			mainTask: undefined,
			otherTasks: []
		});
	});

	it("filters by provided tasks", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(10000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, ["commit"], getLogger("test"));
		expect(tasks.mainTask!.task).toEqual("commit");
		tasks.otherTasks.forEach(task => {
			expect(task.task).toEqual("commit");
		});
	});
});

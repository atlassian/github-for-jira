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
		for (let newRepoStateNo = 1; newRepoStateNo < 500; newRepoStateNo++) {
			const plainObj = repoSyncState.get();
			delete plainObj["id"];
			delete plainObj["commitStatus"];
			delete plainObj["branchStatus"];
			const newRepoSyncState = new RepoSyncState(plainObj);
			newRepoSyncState.repoId = repoSyncState.repoId + newRepoStateNo;
			newRepoSyncState.repoName = repoSyncState.repoName + newRepoStateNo;
			newRepoSyncState.repoFullName = repoSyncState.repoFullName + newRepoStateNo;
			await newRepoSyncState.save();
		}
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
		expect(nextTasks[0].task).toEqual("repository");
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
		expect((await getNextTasks(subscription, [], getLogger("test"))).length).toEqual(1);
	});

	it("uses smallest quota between core and graphql to determine number of subtasks", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(100000, 2000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		expect(tasks.length).toEqual(4);
	});

	it("number of tasks never exceeds some limit", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(100000, 100000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		expect(tasks.length).toEqual(101);
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
		expect(tasks.length).toEqual(20);
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
		expect(tasks.length).toEqual(1);
	});

	it("subtasks are picked only from tasks that would become main tasks soon", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(10000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		tasks.forEach(task => {
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
		tasks.forEach(task => {
			repoIdsAndTaskType.add("" + task.repositoryId + task.task);
		});
		expect(tasks.length).toEqual(repoIdsAndTaskType.size);
	});

	it("returns empty when all tasks are finished", async () => {
		const repoSyncStats = await RepoSyncState.findAllFromSubscription(subscription);
		await Promise.all(repoSyncStats.map((record) => {
			record.branchStatus = "complete";
			record.commitStatus = "complete";
			return record.save();
		}));

		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		expect(tasks.length).toEqual(0);
	});

	it("filters by provided tasks", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_SUBTASKS_FOR_BACKFILL,
			expect.anything()
		).mockResolvedValue(true);

		configureRateLimit(10000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, ["commit"], getLogger("test"));
		tasks.forEach(task => {
			expect(task.task).toEqual("commit");
		});
	});
});

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
			delete newRepoSyncState.id;
			delete newRepoSyncState.commitStatus;
			delete newRepoSyncState.branchStatus;
			newRepoSyncState["repoId"] = repoSyncState.repoId + newRepoStateNo;
			newRepoSyncState["repoName"] = repoSyncState.repoName + newRepoStateNo.toString();
			newRepoSyncState["repoFullName"] = repoSyncState.repoFullName + newRepoStateNo.toString();
			newRepoSyncStatesData.push(newRepoSyncState);
		}
		await RepoSyncState.bulkCreate(newRepoSyncStatesData);
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

	it("first (main) task is always same (deterministic)", async () => {

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
		configureRateLimit(100000, 2000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		// 2000 quota is for 4 tasks (500 reserved for each): 1 main task + 3 other tasks
		expect(tasks.mainTask).toBeDefined();
		expect(tasks.otherTasks.length).toEqual(3);
	});

	it("number of tasks never exceeds limit from FF", async () => {

		configureRateLimit(100000, 100000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		expect(tasks.mainTask).toBeDefined();
		expect(tasks.otherTasks.length).toEqual(100);
	});

	it("does not blow up when quota is higher than available number of tasks", async () => {

		configureRateLimit(100000, 100000);

		const repoSyncStats = await RepoSyncState.findAllFromSubscription(subscription, 1000, 0, [["id", "ASC"]]);
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

		configureRateLimit(10000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks1 = await getNextTasks(subscription, [], getLogger("test"));
		const tasks2 = await getNextTasks(subscription, [], getLogger("test"));
		expect(tasks1).not.toEqual(tasks2);
	});

	it("should return main task only when rate-limiting endpoint errors out", async () => {
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
		configureRateLimit(2000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		expect(tasks.mainTask?.repositoryId).toBeGreaterThan(100);
		tasks.otherTasks.forEach(task => {
			expect(task.repositoryId).toBeGreaterThan(100);
		});
	});

	it("all returned tasks are unique", async () => {
		configureRateLimit(10000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, [], getLogger("test"));
		const repoIdsAndTaskType = new Set<string>();
		tasks.otherTasks.forEach(task => {
			repoIdsAndTaskType.add("" + task.repositoryId.toString() + task.task);
		});
		repoIdsAndTaskType.add("" + tasks.mainTask!.repositoryId.toString() + tasks.mainTask!.task);
		expect(tasks.otherTasks.length + 1).toEqual(repoIdsAndTaskType.size);
	});

	it("all returned other tasks are within some pool", async () => {
		configureRateLimit(10000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const otherTasksAndTaskTypes = new Set<string>();
		for (let i = 0; i < 50; i++) {
			const tasks = await getNextTasks(subscription, [], getLogger("test"));
			tasks.otherTasks.forEach(task => {
				otherTasksAndTaskTypes.add("" + task.repositoryId.toString());
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
		const repoSyncStats = await RepoSyncState.findAllFromSubscription(subscription, 1000, 0, [["id", "DESC"]]);
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

	it("returns empty when all tasks are finished with FF ON", async () => {
		const repoSyncStats = await RepoSyncState.findAllFromSubscription(subscription, 1000, 0, [["id", "DESC"]]);
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

	it("returns empty when all tasks are finished with FF ON and quota provided", async () => {
		configureRateLimit(10000, 10000);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

		const repoSyncStats = await RepoSyncState.findAllFromSubscription(subscription, 1000, 0, [["id", "DESC"]]);
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
		configureRateLimit(10000, 10000);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, ["commit"], getLogger("test"));
		expect(tasks.mainTask!.task).toEqual("commit");
		tasks.otherTasks.forEach(task => {
			expect(task.task).toEqual("commit");
		});
	});
	it("should filter dependabot alerts task if ENABLE_GITHUB_SECURITY_IN_JIRA FF is off", async () => {
		when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(false);
		configureRateLimit(10000, 10000);
		const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, 1000, 0, [["id", "DESC"]]);
		await Promise.all(repoSyncStates.map((record) => {
			record.dependabotAlertStatus = "pending";
			return record.save();
		}));
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, ["dependabotAlert"], getLogger("test"));
		expect(tasks.mainTask).toBeUndefined();
		expect(tasks.otherTasks.length).toEqual(0);
	});

	it("should not filter dependabot alerts task if ENABLE_GITHUB_SECURITY_IN_JIRA FF is on and security permissions accepted", async () => {
		when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
		configureRateLimit(10000, 10000);
		const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, 1000, 0, [["id", "DESC"]]);
		await Promise.all(repoSyncStates.map((record) => {
			record.dependabotAlertStatus = "pending";
			return record.save();
		}));
		await subscription.update({ isSecurityPermissionsAccepted: true });

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, ["dependabotAlert"], getLogger("test"));
		expect(tasks.mainTask!.task).toEqual("dependabotAlert");
		tasks.otherTasks.forEach(task => {
			expect(task.task).toEqual("dependabotAlert");
		});
	});

	it("should filter dependabot alerts task if only ENABLE_GITHUB_SECURITY_IN_JIRA FF is on and security permissions are not accepted", async () => {
		when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
		configureRateLimit(10000, 10000);
		const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, 1000, 0, [["id", "DESC"]]);
		await Promise.all(repoSyncStates.map((record) => {
			record.dependabotAlertStatus = "pending";
			return record.save();
		}));

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, ["dependabotAlert"], getLogger("test"));
		expect(tasks.mainTask).toBeUndefined();
		expect(tasks.otherTasks.length).toEqual(0);
	});


	it("should filter secret scanning alerts task if ENABLE_GITHUB_SECURITY_IN_JIRA FF is off", async () => {
		when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(false);
		configureRateLimit(10000, 10000);
		const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, 1000, 0, [["id", "DESC"]]);
		await Promise.all(repoSyncStates.map((record) => {
			record.secretScanningAlertStatus = "pending";
			return record.save();
		}));
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, ["secretScanningAlert"], getLogger("test"));
		expect(tasks.mainTask).toBeUndefined();
		expect(tasks.otherTasks.length).toEqual(0);
	});
	it("should not filter secret scanning alerts task if ENABLE_GITHUB_SECURITY_IN_JIRA FF is on", async () => {
		when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
		configureRateLimit(10000, 10000);
		const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, 1000, 0, [["id", "DESC"]]);
		await Promise.all(repoSyncStates.map((record) => {
			record.secretScanningAlertStatus = "pending";
			return record.save();
		}));
		await subscription.update({ isSecurityPermissionsAccepted: true });

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		const tasks = await getNextTasks(subscription, ["secretScanningAlert"], getLogger("test"));
		expect(tasks.mainTask!.task).toEqual("secretScanningAlert");
		tasks.otherTasks.forEach(task => {
			expect(task.task).toEqual("secretScanningAlert");
		});
	});
});

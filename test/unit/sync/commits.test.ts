/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { commitsNoLastCursor, commitsWithLastCursor, getDefaultBranch } from "../../fixtures/api/graphql/commit-queries";
import createJob from "../../setup/create-job";
import { Subscription } from "../../../src/models";
import { processInstallation } from "../../../src/sync/installation";
import { mocked } from "ts-jest/utils";
import { Application } from "probot";
import { createApplication } from "../../utils/probot";
import nock from "nock";

jest.mock("../../../src/models");

describe.skip("sync/commits", () => {
	let installationId;
	let delay;
	let app: Application;

	const defaultBranchFixture = require("../../fixtures/api/graphql/default-branch.json");
	const commitNodesFixture = require("../../fixtures/api/graphql/commit-nodes.json");
	const mixedCommitNodes = require("../../fixtures/api/graphql/commit-nodes-mixed.json");
	const defaultBranchNullFixture = require("../../fixtures/api/graphql/default-branch-null.json");
	const commitsNoKeys = require("../../fixtures/api/graphql/commit-nodes-no-keys.json");

	beforeEach(async () => {
		// TODO: move this into utils to easily construct mock data
		const repoSyncStatus = {
			installationId: 12345678,
			jiraHost: "tcbyrd.atlassian.net",
			repos: {
				"test-repo-id": {
					repository: {
						name: "test-repo-name",
						owner: { login: "integrations" },
						html_url: "test-repo-url",
						id: "test-repo-id"
					},
					pullStatus: "complete",
					branchStatus: "complete",
					commitStatus: "pending"
				}
			}
		};
		delay = process.env.LIMITER_PER_INSTALLATION = "2000";

		installationId = 1234;
		Date.now = jest.fn(() => 12345678);

		mocked(Subscription.getSingleInstallation).mockResolvedValue({
			jiraHost,
			id: 1,
			repoSyncState: repoSyncStatus,
			get: () => repoSyncStatus,
			set: () => repoSyncStatus,
			save: () => Promise.resolve({}),
			update: () => Promise.resolve({})
		} as any);

		app = createApplication();
	});

	it("should sync to Jira when Commit Nodes have jira references", async () => {
		const job = createJob({
			data: { installationId, jiraHost },
			opts: { delay }
		});

		githubNock
			.post("/graphql")
			.reply(200, defaultBranchFixture)
			.post("/graphql")
			.reply(200, commitNodesFixture)
			.post("/graphql")
			.reply(200);

		jiraNock.post("/rest/devinfo/0.10/bulk", {
			preventTransitions: true,
			repositories: [
				{
					commits: [
						{
							author: {
								email: "test-author-email@example.com",
								name: "test-author-name"
							},
							authorTimestamp: "test-authored-date",
							displayId: "test-o",
							fileCount: 0,
							hash: "test-oid",
							id: "test-oid",
							issueKeys: ["TES-17"],
							message: "[TES-17] test-commit-message",
							timestamp: "test-authored-date",
							url: "https://github.com/test-login/test-repo/commit/test-sha",
							updateSequenceId: 12345678
						}
					],
					id: "test-repo-id",
					url: "test-repo-url",
					updateSequenceId: 12345678
				}
			],
			properties: {
				installationId: 1234
			}
		}).reply(200);

		const queues = {
			installation: {
				add: jest.fn()
			}
		};
		await expect(processInstallation(app, queues)(job)).toResolve();
		expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
	});

	it("should send Jira all commits that have Issue Keys", async () => {
		const job = createJob({
			data: { installationId, jiraHost },
			opts: { delay }
		});

		githubNock
			.post("/graphql", getDefaultBranch)
			.reply(200, defaultBranchFixture)
			.post("/graphql", commitsNoLastCursor)
			.reply(200, mixedCommitNodes)
			.post("/graphql", commitsWithLastCursor)
			.reply(200);

		jiraNock.post("/rest/devinfo/0.10/bulk", {
			preventTransitions: true,
			repositories: [
				{
					commits: [
						{
							author: {
								email: "test-author-email@example.com",
								name: "test-author-name"
							},
							authorTimestamp: "test-authored-date",
							displayId: "test-o",
							fileCount: 0,
							hash: "test-oid-1",
							id: "test-oid-1",
							issueKeys: ["TES-17"],
							message: "[TES-17] test-commit-message",
							timestamp: "test-authored-date",
							url: "https://github.com/test-login/test-repo/commit/test-sha",
							updateSequenceId: 12345678
						},
						{
							author: {
								avatar: "test-avatar-url",
								email: "test-author-email@example.com",
								name: "test-author-name"
							},
							authorTimestamp: "test-authored-date",
							displayId: "test-o",
							fileCount: 0,
							hash: "test-oid-2",
							id: "test-oid-2",
							issueKeys: ["TES-15"],
							message: "[TES-15] another test-commit-message",
							timestamp: "test-authored-date",
							url: "https://github.com/test-login/test-repo/commit/test-sha",
							updateSequenceId: 12345678
						},
						{
							author: {
								avatar: "test-avatar-url",
								email: "test-author-email@example.com",
								name: "test-author-name"
							},
							authorTimestamp: "test-authored-date",
							displayId: "test-o",
							fileCount: 0,
							hash: "test-oid-3",
							id: "test-oid-3",
							issueKeys: ["TES-14", "TES-15"],
							message: "TES-14-TES-15 message with multiple keys",
							timestamp: "test-authored-date",
							url: "https://github.com/test-login/test-repo/commit/test-sha",
							updateSequenceId: 12345678
						}
					],
					id: "test-repo-id",
					url: "test-repo-url",
					updateSequenceId: 12345678
				}
			],
			properties: {
				installationId: 1234
			}
		}).reply(200);

		const queues = {
			installation: {
				add: jest.fn()
			}
		};
		await expect(processInstallation(app, queues)(job)).toResolve();
		expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
	});

	it("should default to master branch if defaultBranchRef is null", async () => {
		const job = createJob({
			data: { installationId, jiraHost },
			opts: { delay }
		});

		githubNock
			.post("/graphql", getDefaultBranch)
			.reply(200, defaultBranchNullFixture)
			.post("/graphql", commitsNoLastCursor)
			.reply(200, commitNodesFixture)
			.post("/graphql", commitsWithLastCursor)
			.reply(200);

		jiraNock.post("/rest/devinfo/0.10/bulk", {
			preventTransitions: true,
			repositories: [
				{
					commits: [
						{
							author: {
								email: "test-author-email@example.com",
								name: "test-author-name"
							},
							authorTimestamp: "test-authored-date",
							displayId: "test-o",
							fileCount: 0,
							hash: "test-oid",
							id: "test-oid",
							issueKeys: ["TES-17"],
							message: "[TES-17] test-commit-message",
							timestamp: "test-authored-date",
							url: "https://github.com/test-login/test-repo/commit/test-sha",
							updateSequenceId: 12345678
						}
					],
					id: "test-repo-id",
					url: "test-repo-url",
					updateSequenceId: 12345678
				}
			],
			properties: {
				installationId: 1234
			}
		}).reply(200);

		const queues = {
			installation: {
				add: jest.fn()
			}
		};
		await expect(processInstallation(app, queues)(job)).toResolve();
		expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
	});

	it("should not call Jira if no issue keys are present", async () => {
		const job = createJob({
			data: { installationId, jiraHost },
			opts: { delay }
		});

		githubNock
			.post("/graphql", getDefaultBranch)
			.reply(200, defaultBranchFixture)
			.post("/graphql", commitsNoLastCursor)
			.reply(200, commitsNoKeys)
			.post("/graphql", commitsWithLastCursor)
			.reply(200);

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		const queues = {
			installation: {
				add: jest.fn()
			}
		};
		await expect(processInstallation(app, queues)(job)).toResolve();
		expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
		expect(scope).not.toBeDone();
		nock.removeInterceptor(interceptor);
	});

	it("should not call Jira if no data is returned", async () => {
		const job = createJob({ data: { installationId, jiraHost } });

		githubNock
			.post("/graphql", getDefaultBranch)
			.reply(200, defaultBranchFixture)
			.post("/graphql", commitsNoLastCursor)
			.reply(200)
			.post("/graphql", commitsWithLastCursor)
			.reply(200);

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		const queues = {
			installation: {
				add: jest.fn()
			}
		};
		await expect(processInstallation(app, queues)(job)).toResolve();
		expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
		expect(scope).not.toBeDone();
		nock.removeInterceptor(interceptor);
	});
});

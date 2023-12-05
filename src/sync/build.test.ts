/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { cloneDeep } from "lodash";
import { removeInterceptor } from "nock";
import { processInstallation } from "./installation";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import { BackfillMessagePayload } from "../sqs/sqs.types";

import buildFixture from "fixtures/api/build.json";
import multiBuildFixture from "fixtures/api/build-multi.json";
import noKeysBuildFixture from "fixtures/api/build-no-keys.json";
import compareReferencesFixture from "fixtures/api/compare-references.json";
import { DatabaseStateCreator, CreatorResult } from "test/utils/database-state-creator";
import { when } from "jest-when";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { RepoSyncState } from "models/reposyncstate";
import { getBuildTask } from "./build";
import { createInstallationClient } from "~/src/util/get-github-client-config";

const lastMockedWorkflowSubmit = jest.fn();
jest.mock("config/feature-flags");
jest.mock("../jira/client/jira-client", () => ({
	getJiraClient: async (...args) => {
		const actual = await jest.requireActual("../jira/client/jira-client").getJiraClient(...args);
		return {
			...actual,
			workflow: {
				...actual.workflow,
				submit: (...repoArgs) => {
					lastMockedWorkflowSubmit(...repoArgs);
					return actual.workflow.submit(...repoArgs);
				}
			}
		};
	}
}));

describe("sync/builds", () => {
	const sentry: Hub = { setUser: jest.fn() } as any;
	const mockBackfillQueueSendMessage = jest.fn();

	const makeExpectedJiraResponse = (builds) => ({
		builds,
		properties: {
			gitHubInstallationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
			repositoryId: 1
		},
		preventTransitions: true,
		operationType: "BACKFILL",
		providerMetadata: {}
	});

	const createJiraNock = (builds) => {
		jiraNock
			.post("/rest/builds/0.1/bulk", makeExpectedJiraResponse(builds)) // todo look at webhook response
			.reply(200);
	};

	let repoSyncState: RepoSyncState;
	const ORIGINAL_BUILDS_CURSOR = 21;

	let db: CreatorResult;
	beforeEach(async () => {

		mockSystemTime(12345678);

		repoSyncState = (db = await new DatabaseStateCreator()
			.withActiveRepoSyncState()
			.repoSyncStatePendingForBuilds()
			.withBuildsCustomCursor(String(ORIGINAL_BUILDS_CURSOR))
			.create()).repoSyncState!;

		when(numberFlag).calledWith(
			NumberFlags.NUMBER_OF_BUILD_PAGES_TO_FETCH_IN_PARALLEL,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(0);

	});

	it("should sync builds to Jira when build message contains issue key", async () => {
		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

		githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=21`)
			.reply(200, buildFixture);

		githubNock.get(`/repos/integrations/integration-test-jira/compare/BASE_REF...HEAD_REF`)
			.reply(200, compareReferencesFixture);

		createJiraNock([
			{
				"schemaVersion": "1.0",
				"pipelineId": "19236895",
				"buildNumber": 59,
				"updateSequenceNumber": 12345678,
				"displayName": "Build",
				"url": "https://github.com/integrations/integration-test-jira/actions/runs/2152266464",
				"state": "successful",
				"lastUpdated": "2022-04-12T02:05:50Z",
				"issueKeys": [
					"DEP-13",
					"DEP-12"
				],
				"references": [
					{
						"commit": {
							"repositoryUri": "FAKE_URL"
						},
						"ref": {
							"name": "HEAD_REF",
							"uri": "FAKE_URL/tree/HEAD_REF"
						}
					}
				]
			}
		]);

		await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
		expect(mockBackfillQueueSendMessage).toBeCalledWith(data, 0, expect.anything());

		expect(lastMockedWorkflowSubmit).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			"test-repo-name",
			expect.objectContaining({
				auditLogsource: "BACKFILL",
				entityAction: "WORKFLOW_RUN",
				subscriptionId: db.subscription.id
			})
		);
	});

	it("should not explode when returned payload doesn't have head_commit", async () => {
		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

		const fixture = cloneDeep(buildFixture);
		fixture.workflow_runs[0].head_commit = null as unknown as any;

		githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=21`)
			.reply(200, fixture);

		githubNock.get(`/repos/integrations/integration-test-jira/compare/BASE_REF...HEAD_REF`)
			.reply(200, compareReferencesFixture);

		jiraNock
			.post("/rest/builds/0.1/bulk")
			.reply(200);

		await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
		expect(mockBackfillQueueSendMessage).toBeCalledWith(data, 0, expect.anything());
	});

	const NUMBER_OF_PARALLEL_FETCHES = 10;

	it("should fetch pages in parallel when FF is ON", async () => {
		when(numberFlag).calledWith(
			NumberFlags.NUMBER_OF_BUILD_PAGES_TO_FETCH_IN_PARALLEL,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(NUMBER_OF_PARALLEL_FETCHES);

		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

		const pageNocks = new Array(NUMBER_OF_PARALLEL_FETCHES).fill(0).map((_, index) => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			return githubNock
				.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=${21 + index}`)
				.reply(200, buildFixture);
		});

		githubNock.get(`/repos/integrations/integration-test-jira/compare/BASE_REF...HEAD_REF`)
			.times(5)
			.reply(200, compareReferencesFixture);

		jiraNock
			.post("/rest/builds/0.1/bulk")
			.reply(200);

		await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
		expect(mockBackfillQueueSendMessage).toBeCalledWith(data, 0, expect.anything());
		pageNocks.forEach(nock => {
			expect(nock.isDone()).toBeTruthy();
		});
		expect(JSON.parse((await RepoSyncState.findByPk(repoSyncState!.id))?.buildCursor || "")).toStrictEqual({
			perPage: 20,
			pageNo: 31
		});
	});

	it("should finish task with parallel fetching when no more data", async () => {
		when(numberFlag).calledWith(
			NumberFlags.NUMBER_OF_BUILD_PAGES_TO_FETCH_IN_PARALLEL,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(NUMBER_OF_PARALLEL_FETCHES);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

		new Array(NUMBER_OF_PARALLEL_FETCHES).fill(0).map((_, index) => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubNock
				.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=${21 + index}`)
				.reply(200, []);
		});

		await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
		expect((await RepoSyncState.findByPk(repoSyncState!.id))?.buildStatus).toEqual("complete");
	});

	it("scales cursor if necessary", async () => {
		repoSyncState.buildCursor = JSON.stringify({
			perPage: 100, pageNo: 2
		});
		await repoSyncState.save();

		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=6`)
			.reply(200, []);

		await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
		expect((await RepoSyncState.findByPk(repoSyncState!.id))?.buildStatus).toEqual("complete");
	});

	it("should sync multiple builds to Jira when they contain issue keys", async () => {
		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

		githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=21`)
			.reply(200, multiBuildFixture);

		githubNock.get(`/repos/integrations/integration-test-jira/compare/BASE_REF...HEAD_REF`)
			.reply(200, compareReferencesFixture);

		createJiraNock([
			{
				"schemaVersion": "1.0",
				"pipelineId": "19236895",
				"buildNumber": 59,
				"updateSequenceNumber": 12345678,
				"displayName": "Build",
				"url": "https://github.com/integrations/integration-test-jira/actions/runs/2152266464",
				"state": "successful",
				"lastUpdated": "2022-04-12T02:05:50Z",
				"issueKeys": [
					"DEP-13",
					"DEP-12"
				],
				"references": [
					{
						"commit": {
							"repositoryUri": "FAKE_URL"
						},
						"ref": {
							"name": "HEAD_REF",
							"uri": "FAKE_URL/tree/HEAD_REF"
						}
					}
				]
			},
			{
				"schemaVersion": "1.0",
				"pipelineId": "19236895",
				"buildNumber": 59,
				"updateSequenceNumber": 12345678,
				"displayName": "Build",
				"url": "https://github.com/integrations/integration-test-jira/actions/runs/2152266464",
				"state": "successful",
				"lastUpdated": "2022-04-12T02:05:50Z",
				"issueKeys": [
					"TEST-99",
					"TEST-111"
				],
				"references": [
					{
						"commit": {
							"repositoryUri": "FAKE_URL"
						},
						"ref": {
							"name": "HEAD_REF",
							"uri": "FAKE_URL/tree/HEAD_REF"
						}
					}
				]
			}
		]);

		await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
		expect(mockBackfillQueueSendMessage).toBeCalledWith(data, 0, expect.anything());
	});

	it("should not call Jira if no issue keys are present", async () => {
		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

		githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=21`)
			.reply(200, noKeysBuildFixture);

		githubNock.get(`/repos/integrations/integration-test-jira/compare/BASE_REF...HEAD_REF`)
			.reply(200, {
				"commits": []
			});

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
		expect(scope).not.toBeDone();
		removeInterceptor(interceptor);
	});

	it("should not call Jira if no data is returned", async () => {
		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=21`)
			.reply(200, {});

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
		expect(scope).not.toBeDone();
		removeInterceptor(interceptor);
	});

	describe("incremental backfill", () => {

		let repoSyncState: RepoSyncState;
		beforeEach(async () => {
			const dbState = await new DatabaseStateCreator()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForDeployments()
				.create();
			repoSyncState = dbState.repoSyncState!;
		});

		it("should not miss build data when page contains older build", async () => {

			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

			githubNock.get(`/repos/integrations/integration-test-jira/compare/BASE_REF...HEAD_REF`).reply(200, compareReferencesFixture);
			githubNock.get(`/repos/integrations/integration-test-jira/compare/BASE_REF...HEAD_REF`).reply(200, compareReferencesFixture);

			const HALF_MONTH_IN_MILLISEC = 1 * 15 * 24 * 60 * 60 * 1000;
			const ONE_MONTH_IN_MILLISEC = 1 * 31 * 24 * 60 * 60 * 1000;

			const dateNow = new Date();
			const dateOneMonthAgo = new Date(new Date().getTime() - ONE_MONTH_IN_MILLISEC);
			const twoBuilds = {
				"total_count": 2,
				"workflow_runs": [
					Object.assign({}, cloneDeep(buildFixture.workflow_runs[0]), {
						"created_at": dateNow.toISOString(),
						"updated_at": dateNow.toISOString()
					}),
					Object.assign({}, cloneDeep(buildFixture.workflow_runs[0]), {
						"created_at": dateOneMonthAgo.toISOString(),
						"updated_at": dateOneMonthAgo.toISOString()
					})
				]
			};
			githubNock
				.get(`/repos/integrations/test-repo-name/actions/runs?per_page=2&page=1`)
				.reply(200, twoBuilds);

			const gitHubClient = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, getLogger("test"), undefined);
			const result = await getBuildTask(
				getLogger("test"),
				gitHubClient,
				jiraHost,
				{
					id: repoSyncState.repoId,
					name: repoSyncState.repoName,
					full_name: repoSyncState.repoFullName,
					owner: { login: repoSyncState.repoOwner },
					html_url: repoSyncState.repoUrl,
					updated_at: repoSyncState.repoUpdatedAt?.toISOString()
				},
				undefined,
				2,
				{
					jiraHost,
					installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
					commitsFromDate: new Date((new Date().getTime()) - HALF_MONTH_IN_MILLISEC).toISOString()
				}
			);

			expect(result).toEqual({
				edges: [expect.objectContaining({
					total_count: 2,
					cursor: JSON.stringify({ perPage: 2, pageNo: 2 })
				})],
				jiraPayload: expect.objectContaining({
					builds: [expect.objectContaining({
						lastUpdated: dateNow.toISOString()
					}), expect.objectContaining({
						lastUpdated: dateOneMonthAgo.toISOString()
					})]
				})
			});
		});

		it("should not include build data when all data are older build", async () => {

			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

			const HALF_MONTH_IN_MILLISEC = 1 * 15 * 24 * 60 * 60 * 1000;
			const ONE_MONTH_IN_MILLISEC = 1 * 31 * 24 * 60 * 60 * 1000;
			const TWO_MONTH_IN_MILLISEC = 2 * 31 * 24 * 60 * 60 * 1000;

			const dateOneMonthAgo = new Date(new Date().getTime() - ONE_MONTH_IN_MILLISEC);
			const dateTwoMonthAgo = new Date(new Date().getTime() - TWO_MONTH_IN_MILLISEC);
			const twoBuilds = {
				"total_count": 2,
				"workflow_runs": [
					Object.assign({}, cloneDeep(buildFixture.workflow_runs[0]), {
						"created_at": dateOneMonthAgo.toISOString(),
						"updated_at": dateOneMonthAgo.toISOString()
					}),
					Object.assign({}, cloneDeep(buildFixture.workflow_runs[0]), {
						"created_at": dateTwoMonthAgo.toISOString(),
						"updated_at": dateTwoMonthAgo.toISOString()
					})
				]
			};
			githubNock
				.get(`/repos/integrations/test-repo-name/actions/runs?per_page=2&page=1`)
				.reply(200, twoBuilds);

			const gitHubClient = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, getLogger("test"), undefined);
			const result = await getBuildTask(
				getLogger("test"),
				gitHubClient,
				jiraHost,
				{
					id: repoSyncState.repoId,
					name: repoSyncState.repoName,
					full_name: repoSyncState.repoFullName,
					owner: { login: repoSyncState.repoOwner },
					html_url: repoSyncState.repoUrl,
					updated_at: repoSyncState.repoUpdatedAt?.toISOString()
				},
				undefined,
				2,
				{
					jiraHost,
					installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
					commitsFromDate: new Date((new Date().getTime()) - HALF_MONTH_IN_MILLISEC).toISOString()
				}
			);

			expect(result).toEqual({
				edges: [],
				jiraPayload: undefined
			});
		});
	});

});

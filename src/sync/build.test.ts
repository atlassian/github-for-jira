/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { removeInterceptor } from "nock";
import { processInstallation } from "./installation";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import { BackfillMessagePayload } from "../sqs/sqs.types";

import buildFixture from "fixtures/api/build.json";
import multiBuildFixture from "fixtures/api/build-multi.json";
import noKeysBuildFixture from "fixtures/api/build-no-keys.json";
import compareReferencesFixture from "fixtures/api/compare-references.json";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { when } from "jest-when";
import { numberFlag, NumberFlags, booleanFlag, BooleanFlags } from "config/feature-flags";
import { RepoSyncState } from "models/reposyncstate";
import { getBuildTask } from "./build";
import { createInstallationClient } from "~/src/util/get-github-client-config";


jest.mock("config/feature-flags");

describe("sync/builds", () => {
	const sentry: Hub = { setUser: jest.fn() } as any;
	const mockBackfillQueueSendMessage = jest.fn();

	const makeExpectedJiraResponse = (builds) => ({
		builds,
		properties: {
			"gitHubInstallationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID
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

	beforeEach(async () => {

		mockSystemTime(12345678);

		repoSyncState = (await new DatabaseStateCreator()
			.withActiveRepoSyncState()
			.repoSyncStatePendingForBuilds()
			.withBuildsCustomCursor(String(ORIGINAL_BUILDS_CURSOR))
			.create()).repoSyncState!;

	});

	it("should sync builds to Jira when build message contains issue key", async () => {
		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

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
				"pipelineId": 2152266464,
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
	});

	it("should get proper jira payload that within from date when increment ff on", async () => {
		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, commitsFromDate: "2023-01-01" };

		when(booleanFlag).calledWith(BooleanFlags.USE_BACKFILL_ALGORITHM_INCREMENTAL, jiraHost).mockResolvedValue(true);

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

		githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=1&created=%3E%3D2023-01-01T00:00:00.000Z`)
			.reply(200, buildFixture);

		githubNock.get(`/repos/integrations/integration-test-jira/compare/BASE_REF...HEAD_REF`)
			.reply(200, compareReferencesFixture);

		const gitHubClient = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, getLogger("test"), undefined);
		expect(await getBuildTask(
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
			20,
			data
		)).toEqual({
			edges: expect.anything(),
			jiraPayload: expect.objectContaining({
				id: "1",
				name: "test-repo-name",
				builds: expect.arrayContaining([expect.objectContaining({
					"buildNumber": 59
				})])
			})
		});
	});

	it("should use scaled per_page and cursor when FF is ON", async () => {
		when(numberFlag).calledWith(
			NumberFlags.ACCELERATE_BACKFILL_COEF,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(5);

		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

		// Original pages: 12345 67890 12345 67890 1
		// Scaled pages:   --1-- --2-- --3-- --4-- 5
		const nock = githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=100&page=5`)
			.reply(200, buildFixture);

		githubNock.get(`/repos/integrations/integration-test-jira/compare/BASE_REF...HEAD_REF`)
			.reply(200, compareReferencesFixture);

		jiraNock
			.post("/rest/builds/0.1/bulk")
			.reply(200);

		await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
		expect(mockBackfillQueueSendMessage).toBeCalledWith(data, 0, expect.anything());
		expect(nock.isDone()).toBeTruthy();
		expect((await RepoSyncState.findByPk(repoSyncState!.id)).buildCursor).toEqual(String(Number(ORIGINAL_BUILDS_CURSOR) + 5));
	});

	const NUMBER_OF_PARALLEL_FETCHES = 10;

	it("should fetch pages in parallel when FF is ON and more than 6", async () => {
		const SCALE_COEF = 5;

		when(numberFlag).calledWith(
			NumberFlags.ACCELERATE_BACKFILL_COEF,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(6);

		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

		const pageNocks = new Array(NUMBER_OF_PARALLEL_FETCHES).fill(0).map((_, index) => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			return githubNock
				.get(`/repos/integrations/test-repo-name/actions/runs?per_page=100&page=${5 + index}`)
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
		expect((await RepoSyncState.findByPk(repoSyncState!.id)).buildCursor).toEqual(String(Number(ORIGINAL_BUILDS_CURSOR) + SCALE_COEF * NUMBER_OF_PARALLEL_FETCHES));
	});

	it("should finish task with parallel fetching when no more data", async () => {
		when(numberFlag).calledWith(
			NumberFlags.ACCELERATE_BACKFILL_COEF,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(6);

		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

		new Array(NUMBER_OF_PARALLEL_FETCHES).fill(0).map((_, index) => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubNock
				.get(`/repos/integrations/test-repo-name/actions/runs?per_page=100&page=${5 + index}`)
				.reply(200, []);
		});

		await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
		expect((await RepoSyncState.findByPk(repoSyncState!.id)).buildStatus).toEqual("complete");
	});

	it("should sync multiple builds to Jira when they contain issue keys", async () => {
		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

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
				"pipelineId": 2152266464,
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
				"pipelineId": 2152266464,
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
		githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=21`)
			.reply(200, {});

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
		expect(scope).not.toBeDone();
		removeInterceptor(interceptor);
	});

});

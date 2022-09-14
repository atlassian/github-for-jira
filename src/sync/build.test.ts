/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { removeInterceptor } from "nock";
import { processInstallation } from "./installation";
import { Installation } from "models/installation";
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";
import { sqsQueues } from "../sqs/queues";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import { BackfillMessagePayload } from "../sqs/sqs.types";

import buildFixture from "fixtures/api/build.json";
import multiBuildFixture from "fixtures/api/build-multi.json";
import noKeysBuildFixture from "fixtures/api/build-no-keys.json";
import compareReferencesFixture from "fixtures/api/compare-references.json";

jest.mock("../sqs/queues");

describe("sync/builds", () => {
	const installationId = 1234;
	const sentry: Hub = { setUser: jest.fn() } as any;

	const makeExpectedJiraResponse = (builds) => ({
		builds,
		properties: {
			"gitHubInstallationId": 1234
		},
		providerMetadata: {}
	});

	const createJiraNock = (builds) => {
		jiraNock
			.post("/rest/builds/0.1/bulk", makeExpectedJiraResponse(builds)) // todo look at webhook response
			.reply(200);
	};

	beforeEach(async () => {

		mockSystemTime(12345678);

		await Installation.create({
			gitHubInstallationId: installationId,
			jiraHost,
			encryptedSharedSecret: "secret",
			clientKey: "client-key"
		});

		const subscription = await Subscription.create({
			gitHubInstallationId: installationId,
			jiraHost,
			syncStatus: "ACTIVE",
			repositoryStatus: "complete"
		});

		await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: 1,
			repoName: "test-repo-name",
			repoOwner: "integrations",
			repoFullName: "test-repo-name",
			repoUrl: "test-repo-url",
			branchStatus: "complete",
			commitStatus: "complete",
			pullStatus: "complete",
			deploymentStatus: "complete",
			buildStatus: "pending", // We want the next process to be build
			updatedAt: new Date(),
			createdAt: new Date()
		});

		jest.mocked(sqsQueues.backfill.sendMessage).mockResolvedValue();
	});

	it("should sync builds to Jira when build message contains issue key", async () => {
		const data: BackfillMessagePayload = { installationId, jiraHost };

		githubUserTokenNock(installationId);
		githubUserTokenNock(installationId);

		githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=1`)
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

		await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
		expect(sqsQueues.backfill.sendMessage).toBeCalledWith(data, 0, expect.anything());
	});

	it("should sync multiple builds to Jira when they contain issue keys", async () => {
		const data: BackfillMessagePayload = { installationId, jiraHost };

		githubUserTokenNock(installationId);
		githubUserTokenNock(installationId);

		githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=1`)
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

		await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
		expect(sqsQueues.backfill.sendMessage).toBeCalledWith(data, 0, expect.anything());
	});

	it("should not call Jira if no issue keys are present", async () => {
		const data: BackfillMessagePayload = { installationId, jiraHost };

		githubUserTokenNock(installationId);
		githubUserTokenNock(installationId);

		githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=1`)
			.reply(200, noKeysBuildFixture);

		githubNock.get(`/repos/integrations/integration-test-jira/compare/BASE_REF...HEAD_REF`)
			.reply(200, {
				"commits": []
			});

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
		expect(scope).not.toBeDone();
		removeInterceptor(interceptor);
	});

	it("should not call Jira if no data is returned", async () => {
		const data: BackfillMessagePayload = { installationId, jiraHost };

		githubUserTokenNock(installationId);
		githubNock
			.get(`/repos/integrations/test-repo-name/actions/runs?per_page=20&page=1`)
			.reply(200, {});

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
		expect(scope).not.toBeDone();
		removeInterceptor(interceptor);
	});

});

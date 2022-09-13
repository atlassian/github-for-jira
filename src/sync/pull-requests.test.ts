/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { Subscription } from "models/subscription";
import { processInstallation } from "./installation";
import nock from "nock";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import pullRequestList from "fixtures/api/pull-request-list.json";
import pullRequest from "fixtures/api/pull-request.json";
import { RepoSyncState } from "models/reposyncstate";
import { Installation } from "models/installation";

describe("sync/pull-request", () => {
	const gitHubInstallationId = 1234;
	const sentry: Hub = { setUser: jest.fn() } as any as Hub;

	beforeEach(async () => {
		await Installation.create({
			gitHubInstallationId,
			jiraHost,
			encryptedSharedSecret: "secret",
			clientKey: "client-key"
		});
		const subscription = await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			syncStatus: "ACTIVE",
			repositoryStatus: "complete",
			gitHubAppId: null
		});

		await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: 1,
			repoName: "test-repo-name",
			repoOwner: "integrations",
			repoFullName: "test-repo-name",
			repoUrl: "test-repo-url",
			repoUpdatedAt: new Date(),
			repoPushedAt: new Date(),
			branchStatus: "complete",
			commitStatus: "complete",
			pullStatus: "pending", // We want the next process to be pulls
			deploymentStatus: "complete",
			buildStatus: "complete",
			updatedAt: new Date(),
			createdAt: new Date()
		});

		mockSystemTime(12345678);
	});

	describe.each([
		["[TES-15] Evernote Test", "use-the-force"],
		["Evernote Test", "TES-15"]
	])("PR Title: %p, PR Head Ref: %p", (title, head) => {
		it("should sync to Jira when Pull Request Nodes have jira references", async () => {
			pullRequestList[0].title = title;
			pullRequestList[0].head.ref = head;
			githubUserTokenNock(gitHubInstallationId);
			githubUserTokenNock(gitHubInstallationId);
			githubUserTokenNock(gitHubInstallationId);
			githubNock
				.get("/repos/integrations/test-repo-name/pulls")
				.query(true)
				.reply(200, pullRequestList)
				.get("/repos/integrations/test-repo-name/pulls/51")
				.reply(200, pullRequest)
				.get("/users/test-pull-request-author-login")
				.reply(200, {
					login: "test-pull-request-author-login",
					avatar_url: "test-pull-request-author-avatar",
					html_url: "test-pull-request-author-url"
				});

			jiraNock.post("/rest/devinfo/0.10/bulk", {
				"preventTransitions": true,
				"repositories":
					[
						{
							"id": "1",
							"name": "test-repo-name",
							"pullRequests":
								[
									{
										"author":
											{
												"avatar": "test-pull-request-author-avatar",
												"name": "test-pull-request-author-login",
												"email": "test-pull-request-author-login@noreply.user.github.com",
												"url": "test-pull-request-author-url"
											},
										"commentCount": 10,
										"destinationBranch": "devel",
										"destinationBranchUrl": "test-repo-url/tree/devel",
										"displayId": "#51",
										"id": 51,
										"issueKeys":
											[
												"TES-15"
											],
										"lastUpdate": "2018-05-04T14:06:56Z",
										"sourceBranch": "use-the-force",
										"sourceBranchUrl": "test-repo-url/tree/use-the-force",
										"status": "DECLINED",
										"timestamp": "2018-05-04T14:06:56Z",
										"title": "Testing force pushes",
										"url": "https://github.com/integrations/test/pull/51",
										"updateSequenceId": 12345678
									}
								],
							"url": "test-repo-url",
							"updateSequenceId": 12345678
						}
					],
				"properties":
					{
						"installationId": 1234
					}
			}).reply(200);

			await expect(processInstallation()({ installationId: gitHubInstallationId, jiraHost }, sentry, getLogger("test"))).toResolve();
		});
	});

	it("should not sync if nodes are empty", async () => {
		githubUserTokenNock(gitHubInstallationId);
		githubNock
			.get("/repos/integrations/test-repo-name/pulls")
			.query(true)
			.reply(200, []);

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		await expect(processInstallation()({ installationId: gitHubInstallationId, jiraHost }, sentry, getLogger("test"))).toResolve();
		expect(scope).not.toBeDone();
		nock.removeInterceptor(interceptor);
	});

	it("should not sync if nodes do not contain issue keys", async () => {
		githubUserTokenNock(gitHubInstallationId);
		githubNock.get("/repos/integrations/test-repo-name/pulls")
			.query(true)
			.reply(200, pullRequestList);

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		await expect(processInstallation()({ installationId: gitHubInstallationId, jiraHost }, sentry, getLogger("test"))).toResolve();
		expect(scope).not.toBeDone();
		nock.removeInterceptor(interceptor);
	});
});

/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { mocked } from "ts-jest/utils";
import { Subscription } from "models/models";
import { Application } from "probot";
import { processInstallation } from "./installation";
import nock from "nock";
import { RepoSyncStateObject } from "models/subscription";
import { createWebhookApp } from "test/utils/probot";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";

import pullRequestList from "fixtures/api/pull-request-list.json";

jest.mock("models/models");

describe.skip("sync/pull-request", () => {
	const installationId = 1234;
	let app: Application;

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	const sentry: Hub = { setUser: jest.fn() } as Hub;

	beforeEach(async () => {
		jest.setTimeout(10000);
		const repoSyncStatus: RepoSyncStateObject = {
			installationId: 12345678,
			jiraHost: "tcbyrd.atlassian.net",
			repos: {
				"test-repo-id": {
					repository: {
						name: "test-repo-name",
						full_name: "test-repo-name",
						owner: { login: "integrations" },
						html_url: "test-repo-url",
						id: "test-repo-id",
						updated_at: 123456789
					},
					pullStatus: "pending",
					branchStatus: "complete",
					commitStatus: "complete"
				}
			}
		};

		mockSystemTime(12345678);

		mocked(Subscription.getSingleInstallation)
			.mockResolvedValue({
				jiraHost,
				id: 1,
				get: () => repoSyncStatus,
				set: () => repoSyncStatus,
				save: () => Promise.resolve({}),
				update: () => Promise.resolve({})
			} as any);

		app = await createWebhookApp();
	});

	describe.each([
		["[TES-15] Evernote Test", "use-the-force"],
		["Evernote Test", "TES-15"]
	])("PR Title: %p, PR Head Ref: %p", (title, head) => {
		it("should sync to Jira when Pull Request Nodes have jira references", async () => {
			const data = { installationId, jiraHost };
			pullRequestList[0].title = title;
			pullRequestList[0].head.ref = head;

			githubNock
				.get("/repos/integrations/test-repo-name/pulls?per_page=20&page=1&state=all&sort=created&direction=desc")
				.reply(200, pullRequestList)
				.get("/repos/integrations/test-repo-name/pulls/51")
				.reply(200, { comments: 0 });

			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: true,
				repositories: [
					{
						id: "test-repo-id",
						pullRequests: [
							{
								author: {
									avatar: "https://avatars0.githubusercontent.com/u/173?v=4",
									name: "bkeepers",
									url: "https://api.github.com/users/bkeepers"
								},
								commentCount: 0,
								destinationBranch: "devel",
								destinationBranchUrl: "test-repo-url/tree/devel",
								displayId: "#51",
								id: 51,
								issueKeys: ["TES-15"],
								lastUpdate: "2018-05-04T14:06:56Z",
								sourceBranch: head,
								sourceBranchUrl: `test-repo-url/tree/${head}`,
								status: "DECLINED",
								timestamp: "2018-05-04T14:06:56Z",
								title,
								url: "https://github.com/integrations/test/pull/51",
								updateSequenceId: 12345678
							}
						],
						url: "test-repo-url",
						updateSequenceId: 12345678
					}
				],
				properties: { installationId: 1234 }
			}).reply(200);

			await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
		});
	});

	it("should not sync if nodes are empty", async () => {
		const data = { installationId, jiraHost };

		githubNock.get("/repos/integrations/test-repo-name/pulls?per_page=20&page=1&state=all&sort=created&direction=desc")
			.reply(200, []);

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
		expect(scope).not.toBeDone();
		nock.removeInterceptor(interceptor);
	});

	// TODO: fix this test.  Can't figure out why githubNock isn't working for this one...
	it("should not sync if nodes do not contain issue keys", async () => {
		process.env.LIMITER_PER_INSTALLATION = "2000";
		githubNock.get("/repos/integrations/test-repo-name/pulls")
			.query(true)
			.reply(200, pullRequestList);

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		await expect(processInstallation(app)(pullRequestList as any, sentry, getLogger("test"))).toResolve();
		expect(scope).not.toBeDone();
		nock.removeInterceptor(interceptor);
	});
});

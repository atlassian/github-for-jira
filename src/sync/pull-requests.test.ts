/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { processInstallation } from "./installation";
import { removeInterceptor } from "nock";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import pullRequestList from "fixtures/api/pull-request-list.json";
import pullRequest from "fixtures/api/pull-request.json";
import { GitHubServerApp } from "models/github-server-app";
import { when } from "jest-when";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { RepoSyncState } from "models/reposyncstate";
import { getPullRequestTask } from "./pull-request";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import _ from "lodash";

jest.mock("config/feature-flags");

describe("sync/pull-request", () => {
	const sentry: Hub = { setUser: jest.fn() } as any as Hub;

	beforeEach(() => {
		mockSystemTime(12345678);

		when(numberFlag).calledWith(
			NumberFlags.NUMBER_OF_PR_PAGES_TO_FETCH_IN_PARALLEL,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(0);
	});


	const reviewsPayload = [
		{
			id: 80,
			node_id: "MDE3OlB1bGxSZXF1ZXN0UmV2aWV3ODA=",
			user: {
				login: "test-pull-request-reviewer-login",
				id: 1,
				node_id: "MDQ6VXNlcjE=",
				avatar_url: "test-pull-request-reviewer-avatar",
				gravatar_id: "",
				url: "https://api.github.com/users/reviewer",
				html_url: "https://github.com/reviewer",
				followers_url: "https://api.github.com/users/reviewer/followers",
				following_url: "https://api.github.com/users/reviewer/following{/other_user}",
				gists_url: "https://api.github.com/users/reviewer/gists{/gist_id}",
				starred_url: "https://api.github.com/users/reviewer/starred{/owner}{/repo}",
				subscriptions_url: "https://api.github.com/users/reviewer/subscriptions",
				organizations_url: "https://api.github.com/users/reviewer/orgs",
				repos_url: "https://api.github.com/users/reviewer/repos",
				events_url: "https://api.github.com/users/reviewer/events{/privacy}",
				received_events_url: "https://api.github.com/users/reviewer/received_events",
				type: "User",
				site_admin: false
			},
			body: "Here is the body for the review.",
			state: "APPROVED",
			html_url: "https://github.com/integrations/test-repo-name/pull/1#pullrequestreview-80",
			pull_request_url: "https://api.github.com/repos/integrations/test-repo-name/pulls/1",
			_links: {
				html: {
					href: "https://github.com/integrations/test-repo-name/pull/1#pullrequestreview-80"
				},
				pull_request: {
					href: "https://api.github.com/repos/integrations/test-repo-name/pulls/1"
				}
			},
			submitted_at: "2019-11-17T17:43:43Z",
			commit_id: "ecdd80bb57125d7ba9641ffaa4d7d2c19d3f3091",
			author_association: "COLLABORATOR"
		}
	];

	const buildJiraPayload = (repoId: string, times = 1) => {
		const pr = {
			"author": {
				"avatar": "test-pull-request-author-avatar",
				"name": "test-pull-request-author-login",
				"email": "test-pull-request-author-login@noreply.user.github.com",
				"url": "test-pull-request-author-url"
			},
			"commentCount": 10,
			"destinationBranch": "devel",
			"destinationBranchUrl": "https://github.com/integrations/test/tree/devel",
			"displayId": "#51",
			"id": 51,
			"issueKeys": [
				"KEY-15"
			],
			"lastUpdate": "2018-05-04T14:06:56Z",
			"reviewers": [
				{
					"avatar": "test-pull-request-reviewer-avatar",
					"name": "test-pull-request-reviewer-login",
					"email": "test-pull-request-reviewer-login@email.test",
					"url": "https://github.com/reviewer",
					"approvalStatus": "APPROVED"
				}
			],
			"sourceBranch": "use-the-force",
			"sourceBranchUrl": "https://github.com/integrations/test/tree/use-the-force",
			"status": "DECLINED",
			"timestamp": "2018-05-04T14:06:56Z",
			"title": "[KEY-15] Testing force pushes",
			"url": "https://github.com/integrations/test/pull/51",
			"updateSequenceId": 12345678
		};

		return {
			"preventTransitions": true,
			operationType: "BACKFILL",
			"repositories":
				[
					{
						"id": repoId,
						"name": "test-repo-name",
						"pullRequests": Array(times).fill(pr),
						"url": "test-repo-url",
						"updateSequenceId": 12345678
					}
				],
			"properties":
				{
					"installationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID
				}
		};
	};

	describe("cloud", () => {

		let repoSyncState: RepoSyncState;

		const PRS_INITIAL_CURSOR = 21;

		beforeEach(async () => {
			repoSyncState = (await new DatabaseStateCreator()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForPrs()
				.withPrsCustomCursor(String(PRS_INITIAL_CURSOR))
				.create()).repoSyncState!;
		});

		describe.each([
			["[TES-15] Evernote Test", "use-the-force"],
			["Evernote Test", "TES-15"]
		])("PR Title: %p, PR Head Ref: %p", (title, head) => {
			it("should sync to Jira when Pull Request Nodes have jira references", async () => {
				const modifiedList = _.cloneDeep(pullRequestList);
				modifiedList[0].title = title;
				modifiedList[0].head.ref = head;
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock
					.get("/repos/integrations/test-repo-name/pulls?per_page=20&page=21&state=all&sort=created&direction=desc")
					.reply(200, modifiedList)
					.get("/repos/integrations/test-repo-name/pulls/51")
					.reply(200, pullRequest)
					.get("/repos/integrations/test-repo-name/pulls/51/reviews")
					.reply(200, reviewsPayload)
					.get("/users/test-pull-request-reviewer-login")
					.reply(200, {
						login: "test-pull-request-reviewer-login",
						avatar_url: "test-pull-request-reviewer-avatar",
						html_url: "test-pull-request-reviewer-url",
						email: "test-pull-request-reviewer-login@email.test"
					})
					.get("/users/test-pull-request-author-login")
					.reply(200, {
						login: "test-pull-request-author-login",
						avatar_url: "test-pull-request-author-avatar",
						html_url: "test-pull-request-author-url"
					})
					.get("/users/integrations")
					.reply(200, {
						login: "integrations",
						avatar_url: "integrations-avatar",
						html_url: "integrations-url"
					});

				jiraNock.post("/rest/devinfo/0.10/bulk", buildJiraPayload("1")).reply(200);

				await expect(processInstallation(jest.fn())({
					installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
					jiraHost
				}, sentry, getLogger("test"))).toResolve();
			});
		});

		it("uses parallel fetching when FF is more than 1", async () => {
			const modifiedList = _.cloneDeep(pullRequestList);
			modifiedList[0].title = "TES-15";

			when(numberFlag).calledWith(
				NumberFlags.NUMBER_OF_PR_PAGES_TO_FETCH_IN_PARALLEL,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(2);

			for (let i = 0; i < 12; i++) {
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			}

			githubNock
				.get("/repos/integrations/test-repo-name/pulls/51").times(2)
				.reply(200, pullRequest)
				.get("/repos/integrations/test-repo-name/pulls/51/reviews").times(2)
				.reply(200, reviewsPayload)
				.get("/users/test-pull-request-reviewer-login").times(2)
				.reply(200, {
					login: "test-pull-request-reviewer-login",
					avatar_url: "test-pull-request-reviewer-avatar",
					html_url: "test-pull-request-reviewer-url",
					email: "test-pull-request-reviewer-login@email.test"
				})
				.get("/users/test-pull-request-author-login").times(2)
				.reply(200, {
					login: "test-pull-request-author-login",
					avatar_url: "test-pull-request-author-avatar",
					html_url: "test-pull-request-author-url"
				})
				.get("/users/integrations").times(2)
				.reply(200, {
					login: "integrations",
					avatar_url: "integrations-avatar",
					html_url: "integrations-url"
				});

			const nockPage1 = githubNock
				.get("/repos/integrations/test-repo-name/pulls?per_page=20&page=21&state=all&sort=created&direction=desc")
				.reply(200, modifiedList);

			const nockPage2 = githubNock
				.get("/repos/integrations/test-repo-name/pulls?per_page=20&page=22&state=all&sort=created&direction=desc")
				.reply(200, modifiedList);

			jiraNock.post("/rest/devinfo/0.10/bulk", buildJiraPayload("1", 2)).reply(200);

			await expect(processInstallation(jest.fn())({
				installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
				jiraHost
			}, sentry, getLogger("test"))).toResolve();
			expect(nockPage1.isDone()).toBeTruthy();
			expect(nockPage2.isDone()).toBeTruthy();
			expect(JSON.parse((await RepoSyncState.findByPk(repoSyncState!.id))?.pullCursor || "")).toStrictEqual({
				pageNo: 23,
				perPage: 20
			});
		});

		it("processing of PRs with parallel fetching should stop when no more PRs from GitHub", async () => {
			when(numberFlag).calledWith(
				NumberFlags.NUMBER_OF_PR_PAGES_TO_FETCH_IN_PARALLEL,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(2);

			for (let i = 0; i < 2; i++) {
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			}

			const nockPage1 = githubNock
				.get("/repos/integrations/test-repo-name/pulls?per_page=20&page=21&state=all&sort=created&direction=desc")
				.reply(200, []);

			const nockPage2 = githubNock
				.get("/repos/integrations/test-repo-name/pulls?per_page=20&page=22&state=all&sort=created&direction=desc")
				.reply(200, []);

			await expect(processInstallation(jest.fn())({
				installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
				jiraHost
			}, sentry, getLogger("test"))).toResolve();
			expect(nockPage1.isDone()).toBeTruthy();
			expect(nockPage2.isDone()).toBeTruthy();
			expect((await RepoSyncState.findByPk(repoSyncState!.id))?.pullStatus).toEqual("complete");
		});

		it("scales cursor if necessary", async () => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

			repoSyncState.pullCursor = JSON.stringify({
				perPage: 100, pageNo: 2
			});
			await repoSyncState.save();

			const nockPage = githubNock
				.get("/repos/integrations/test-repo-name/pulls?per_page=20&page=6&state=all&sort=created&direction=desc")
				.reply(200, []);

			await expect(processInstallation(jest.fn())({
				installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
				jiraHost
			}, sentry, getLogger("test"))).toResolve();
			expect(nockPage.isDone()).toBeTruthy();
			expect((await RepoSyncState.findByPk(repoSyncState!.id))?.pullStatus).toEqual("complete");
		});

		it("should not sync if nodes are empty", async () => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubNock
				.get("/repos/integrations/test-repo-name/pulls")
				.query(true)
				.reply(200, []);

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation(jest.fn())({
				installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
				jiraHost
			}, sentry, getLogger("test"))).toResolve();
			expect(scope).not.toBeDone();
			removeInterceptor(interceptor);
		});

		it("should not sync if nodes do not contain issue keys", async () => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID).persist();
			githubNock.get("/repos/integrations/test-repo-name/pulls")
				.query(true)
				.reply(200, pullRequestList);

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation(jest.fn())({
				installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
				jiraHost
			}, sentry, getLogger("test"))).toResolve();
			expect(scope).not.toBeDone();
			removeInterceptor(interceptor);
		});

		it("should only use pull requests that are later than fromDate is supplied", async () => {

			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

			const mockPullRequestList = () => {
				githubNock
					.get("/repos/integrations/test-repo-name/pulls?per_page=20&page=1&state=all&sort=created&direction=desc")
					.reply(200, [
						{ ...pullRequest, title: "PR3", created_at: "2023-01-03T00:00:00Z" },
						{ ...pullRequest, title: "PR2", created_at: "2023-01-02T00:00:00Z" },
						{ ...pullRequest, title: "PR1", created_at: "2023-01-01T00:00:00Z" }
					]);
			};

			mockPullRequestList();

			const gitHubClient = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, getLogger("test"), undefined);
			expect(await getPullRequestTask(getLogger("test"),
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
				{
					jiraHost,
					installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
					commitsFromDate: "2023-01-01T01:02:03Z"
				}
			)).toEqual({
				edges: expect.arrayContaining([expect.objectContaining({
					title: "PR3",
					created_at: "2023-01-03T00:00:00Z"
				}), expect.objectContaining({
					title: "PR2",
					created_at: "2023-01-02T00:00:00Z"
				})]),
				jiraPayload: undefined
			});

		});

	});

	describe("server", () => {
		let gitHubServerApp: GitHubServerApp;

		beforeEach(async () => {
			const buildResult = await new DatabaseStateCreator()
				.forServer()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForPrs()
				.create();
			gitHubServerApp = buildResult.gitHubServerApp!;
		});

		it("should sync to Jira when Pull Request Nodes have jira references", async () => {
			const modifiedList = _.cloneDeep(pullRequestList);
			modifiedList[0].title = "[TES-15] Evernote Test";
			modifiedList[0].head.ref = "Evernote Test";
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheApiNock
				.get("/repos/integrations/test-repo-name/pulls")
				.query(true)
				.reply(200, modifiedList)
				.get("/repos/integrations/test-repo-name/pulls/51")
				.reply(200, pullRequest)
				.get("/repos/integrations/test-repo-name/pulls/51/reviews")
				.reply(200, reviewsPayload)
				.get("/users/test-pull-request-reviewer-login")
				.reply(200, {
					login: "test-pull-request-reviewer-login",
					avatar_url: "test-pull-request-reviewer-avatar",
					html_url: "test-pull-request-reviewer-url",
					email: "test-pull-request-reviewer-login@email.test"
				})
				.get("/users/test-pull-request-author-login")
				.reply(200, {
					login: "test-pull-request-author-login",
					avatar_url: "test-pull-request-author-avatar",
					html_url: "test-pull-request-author-url"
				})
				.get("/users/integrations")
				.reply(200, {
					login: "integrations",
					avatar_url: "integrations-avatar",
					html_url: "integrations-url"
				});

			jiraNock.post("/rest/devinfo/0.10/bulk", buildJiraPayload("6769746875626d79646f6d61696e636f6d-1")).reply(200);

			const data: BackfillMessagePayload = {
				installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
				jiraHost,
				gitHubAppConfig: {
					uuid: gitHubServerApp.uuid,
					gitHubAppId: gitHubServerApp.id,
					appId: gitHubServerApp.appId,
					clientId: gitHubServerApp.gitHubClientId,
					gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
					gitHubApiUrl: gitHubServerApp.gitHubBaseUrl + "/v3/api"
				}
			};

			await expect(processInstallation(jest.fn())(data, sentry, getLogger("test"))).toResolve();
		});
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

		it("should not miss pull request data when page contains older prs", async () => {

			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

			const twoPRs = [
				_.cloneDeep(pullRequestList[0]),
				_.cloneDeep(pullRequestList[0])
			];

			const HALF_MONTH_IN_MILLISEC = 1 * 15 * 24 * 60 * 60 * 1000;
			const ONE_MONTH_IN_MILLISEC = 1 * 31 * 24 * 60 * 60 * 1000;
			twoPRs[0].created_at = new Date().toISOString();
			twoPRs[1].created_at = new Date((new Date().getTime()) - ONE_MONTH_IN_MILLISEC).toISOString();

			githubNock
				.get("/repos/integrations/test-repo-name/pulls?per_page=2&page=1&state=all&sort=created&direction=desc")
				.reply(200, twoPRs);

			const gitHubClient = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, getLogger("test"), undefined);
			const result = await getPullRequestTask(
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
					cursor: JSON.stringify({ perPage: 2, pageNo: 2 })
				}), expect.objectContaining({
					cursor: JSON.stringify({ perPage: 2, pageNo: 2 })
				})],
				jiraPayload: undefined
			});
		});
	});
});

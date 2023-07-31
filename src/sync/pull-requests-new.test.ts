/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { processInstallation } from "./installation";
import { removeInterceptor } from "nock";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import pullRequestList from "fixtures/api/pull-request-list.json";
// import pullRequest from "fixtures/api/pull-request.json";
import { GitHubServerApp } from "models/github-server-app";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
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

		when(booleanFlag).calledWith(
			BooleanFlags.USE_NEW_PULL_ALGO,
			jiraHost
		).mockResolvedValue(true);
	});

	// const reviewsPayload = [
	// 	{
	// 		id: 80,
	// 		node_id: "MDE3OlB1bGxSZXF1ZXN0UmV2aWV3ODA=",
	// 		user: {
	// 			login: "test-pull-request-reviewer-login",
	// 			id: 1,
	// 			node_id: "MDQ6VXNlcjE=",
	// 			avatar_url: "test-pull-request-reviewer-avatar",
	// 			gravatar_id: "",
	// 			url: "https://api.github.com/users/reviewer",
	// 			html_url: "https://github.com/reviewer",
	// 			followers_url: "https://api.github.com/users/reviewer/followers",
	// 			following_url: "https://api.github.com/users/reviewer/following{/other_user}",
	// 			gists_url: "https://api.github.com/users/reviewer/gists{/gist_id}",
	// 			starred_url: "https://api.github.com/users/reviewer/starred{/owner}{/repo}",
	// 			subscriptions_url: "https://api.github.com/users/reviewer/subscriptions",
	// 			organizations_url: "https://api.github.com/users/reviewer/orgs",
	// 			repos_url: "https://api.github.com/users/reviewer/repos",
	// 			events_url: "https://api.github.com/users/reviewer/events{/privacy}",
	// 			received_events_url: "https://api.github.com/users/reviewer/received_events",
	// 			type: "User",
	// 			site_admin: false
	// 		},
	// 		body: "Here is the body for the review.",
	// 		state: "APPROVED",
	// 		html_url: "https://github.com/integrations/test-repo-name/pull/1#pullrequestreview-80",
	// 		pull_request_url: "https://api.github.com/repos/integrations/test-repo-name/pulls/1",
	// 		_links: {
	// 			html: {
	// 				href: "https://github.com/integrations/test-repo-name/pull/1#pullrequestreview-80"
	// 			},
	// 			pull_request: {
	// 				href: "https://api.github.com/repos/integrations/test-repo-name/pulls/1"
	// 			}
	// 		},
	// 		submitted_at: "2019-11-17T17:43:43Z",
	// 		commit_id: "ecdd80bb57125d7ba9641ffaa4d7d2c19d3f3091",
	// 		author_association: "COLLABORATOR"
	// 	}
	// ];

	const buildJiraPayload = (repoId: string, _times = 1) => {
		const pr = {
			"id": repoId,
			"name": "test-repo-name",
			"url": "test-repo-url",
			"updateSequenceId": 12345678,
			"pullRequests": [
				{
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
						"TES-15"
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
					"title": "[TES-15] Evernote Test",
					"url": "https://github.com/integrations/test/pull/51",
					"updateSequenceId": 12345678
				}
			]
		};

		return {
			"preventTransitions": true,
			operationType: "BACKFILL",
			"repositories":
				[
					pr
					// {
					// 	"id": repoId,
					// 	"name": "test-repo-name",
					// 	"pullRequests": Array(times).fill(pr),
					// 	"url": "test-repo-url",
					// 	"updateSequenceId": 12345678
					// }
				],
			"properties":
				{
					"installationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID
				}
		};
	};

	describe.skip("cloud", () => {

		const PRS_INITIAL_CURSOR = 21;

		beforeEach(async () => {

			when(booleanFlag).calledWith(
				BooleanFlags.USE_NEW_PULL_ALGO,
				jiraHost
			).mockResolvedValue(true);

			await new DatabaseStateCreator()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForPrs()
				.withPrsCustomCursor(String(PRS_INITIAL_CURSOR))
				.create();
		});

		describe.each([
			// ["[TES-15] Evernote Test", "use-the-force"]
			["[TES-15] Evernote Test" , "use-the-force"]
		])("PR Title: %p, PR Head Ref: %p", (title, head) => {
			it("should sync to Jira when Pull Request Nodes have jira references", async () => {
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock
					.post("/graphql")
					.query(true)
					.reply(200, {
						data: {
							repository: {
								pullRequests: {
									edges: [
										{
											node: {
												state: "DECLINED",
												number: 51,
												url: "https://github.com/integrations/test/pull/51",
												author: {
													login: "test-pull-request-author-login",
													email: "test-pull-request-author-login@noreply.user.github.com",
													url: "test-pull-request-author-url",
													avatarUrl: "test-pull-request-author-avatar"
												},
												comments: {
													totalCount: 10
												},
												updatedAt: "2018-05-04T14:06:56Z",
												title,
												baseRef: {
													name: "devel",
													repository: {
														name: "test",
														owner: {
															login: "integrations"
														}
													}
												},
												headRef: {
													name: head,
													repository: {
														name: "test",
														owner: {
															login: "integrations"
														}
													}
												},
												body: "",
												reviews: {
													nodes: [
														{
															submittedAt: "0",
															state: "APPROVED",
															author: {
																login: "test-pull-request-reviewer-login",
																avatarUrl: "test-pull-request-reviewer-avatar",
																email: "test-pull-request-reviewer-login@email.test",
																url: "https://github.com/reviewer"
															}
														}
													]
												}
											}
										}
									]
								}
							}
						}
					});

				jiraNock.post("/rest/devinfo/0.10/bulk", buildJiraPayload("1")).reply(200);

				await expect(processInstallation(jest.fn())({
					installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
					jiraHost
				}, sentry, getLogger("test"))).toResolve();
			});
		});

		it("should not sync if nodes are empty", async () => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubNock
				.post("/graphql")
				.query(true)
				.reply(200, {
					data: {
						repository: {
							pullRequests: {
								edges: []
							}
						}
					}
				});

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
			githubNock
				.post("/graphql")
				.query(true)
				.reply(200, {
					data: {
						repository: {
							pullRequests: {
								edges: [
									{
										node: {
											state: "DECLINED",
											number: 51,
											url: "https://github.com/integrations/test/pull/51",
											author: {
												login: "test-pull-request-author-login",
												email: "test-pull-request-author-login@noreply.user.github.com",
												url: "test-pull-request-author-url",
												avatarUrl: "test-pull-request-author-avatar"
											},
											comments: {
												totalCount: 10
											},
											updatedAt: "2018-05-04T14:06:56Z",
											title: "no issue keys here sadface:",
											baseRef: {
												name: "devel",
												repository: {
													name: "test",
													owner: {
														login: "integrations"
													}
												}
											},
											headRef: {
												name: "head",
												repository: {
													name: "test",
													owner: {
														login: "integrations"
													}
												}
											},
											body: "",
											reviews: {
												nodes: [
													{
														submittedAt: "0",
														state: "APPROVED",
														author: {
															login: "test-pull-request-reviewer-login",
															avatarUrl: "test-pull-request-reviewer-avatar",
															email: "test-pull-request-reviewer-login@email.test",
															url: "https://github.com/reviewer"
														}
													}
												]
											}
										}
									}
								]
							}
						}
					}
				});

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation(jest.fn())({
				installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
				jiraHost
			}, sentry, getLogger("test"))).toResolve();
			expect(scope).not.toBeDone();
			removeInterceptor(interceptor);
		});
	});

	describe.skip("server", () => {
		let gitHubServerApp: GitHubServerApp;

		beforeEach(async () => {

			when(booleanFlag).calledWith(
				BooleanFlags.USE_NEW_PULL_ALGO,
				jiraHost
			).mockResolvedValue(true);

			const buildResult = await new DatabaseStateCreator()
				.forServer()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForPrs()
				.create();
			gitHubServerApp = buildResult.gitHubServerApp!;
		});

		it("should sync to Jira when Pull Request Nodes have jira references", async () => {
			// const modifiedList = _.cloneDeep(pullRequestList);
			// modifiedList[0].title = "[TES-15] Evernote Test";
			// modifiedList[0].head.ref = "Evernote Test";
			// gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID).persist();
			gheApiNock
				.post("/graphqlzzzz")
				.query(true)
				.reply(200, {
					data: {
						repository: {
							pullRequests: {
								edges: [
									{
										node: {
											state: "DECLINED",
											number: 51,
											url: "https://github.com/integrations/test/pull/51",
											author: {
												login: "test-pull-request-author-login",
												email: "test-pull-request-author-login@noreply.user.github.com",
												url: "test-pull-request-author-url",
												avatarUrl: "test-pull-request-author-avatar"
											},
											comments: {
												totalCount: 10
											},
											updatedAt: "2018-05-04T14:06:56Z",
											title: "[TES-15] Evernote Test",
											baseRef: {
												name: "devel",
												repository: {
													name: "test",
													owner: {
														login: "integrations"
													}
												}
											},
											headRef: {
												name: "Evernote Test",
												repository: {
													name: "test",
													owner: {
														login: "integrations"
													}
												}
											},
											body: "",
											reviews: {
												nodes: [
													{
														submittedAt: "0",
														state: "APPROVED",
														author: {
															login: "test-pull-request-reviewer-login",
															avatarUrl: "test-pull-request-reviewer-avatar",
															email: "test-pull-request-reviewer-login@email.test",
															url: "https://github.com/reviewer"
														}
													}
												]
											}
										}
									}
								]
							}
						}
					}
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


	// TODO create pullRequestList with graphqql response then reuse this as is, prety easy
	describe.skip("incremental backfill", () => {

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

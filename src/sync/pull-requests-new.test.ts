/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { processInstallation } from "./installation";
import nock, { removeInterceptor } from "nock";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import { GitHubServerApp } from "models/github-server-app";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { RepoSyncState } from "models/reposyncstate";
import { getPullRequestTask } from "./pull-request";
import { createInstallationClient } from "~/src/util/get-github-client-config";

jest.mock("config/feature-flags");

describe("sync/pull-request", () => {
	const sentry: Hub = { setUser: jest.fn() } as any as Hub;

	beforeEach(() => {
		mockSystemTime(12345678);
	});

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
					"destinationBranchUrl": "https://github.com/integrations/test-repo-name/tree/devel",
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
					"sourceBranchUrl": "https://github.com/integrations/sweet-repo/tree/use-the-force",
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
				],
			"properties":
				{
					"installationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID
				}
		};
	};

	describe("cloud", () => {

		const PRS_INITIAL_CURSOR = 21;

		beforeEach(async () => {
			await new DatabaseStateCreator()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForPrs()
				.withPrsCustomCursor(String(PRS_INITIAL_CURSOR))
				.create();
		});

		describe.each([
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
												createdAt: "2018-05-04T14:06:56Z",
												title,
												baseRefName: "devel",
												baseRef: {
													name: "devel",
													repository: {
														name: "test",
														owner: {
															login: "integrations"
														}
													}
												},
												headRefName: "use-the-force",
												headRef: {
													name: head,
													repository: {
														name: "sweet-repo",
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
											createdAt: "2018-05-04T14:06:56Z",
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
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID).persist();
			nock(global.gheUrl)
				.post("/api/graphql")
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
											createAt: "2018-05-04T14:06:56Z",
											title: "[TES-15] Evernote Test",
											baseRefName: "devel",
											baseRef: {
												name: "devel",
												repository: {
													name: "test",
													owner: {
														login: "integrations"
													}
												}
											},
											headRefName: "use-the-force",
											headRef: {
												name: "use-the-force",
												repository: {
													name: "sweet-repo",
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

	describe("incremental backfill", () => {

		let repoSyncState: RepoSyncState;
		beforeEach(async () => {

			const dbState = await new DatabaseStateCreator()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForDeployments()
				.create();
			repoSyncState = dbState.repoSyncState!;
		});

		const pullRequestNode = (createdAt = "2018-05-04T14:06:56Z") => {
			return {
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
				createdAt,
				title: "ARC-111 mmmhmmmm Test",
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

							}
						}
					]
				}
			};
		};

		it("should fetch all pulls with newer than commitSince", async () => {

			const HALF_MONTH_IN_MILLISEC = 1 * 15 * 24 * 60 * 60 * 1000;
			const ONE_MONTH_IN_MILLISEC = 1 * 31 * 24 * 60 * 60 * 1000;
			const SIX_MONTH_IN_MILLISEC = 6 * 31 * 24 * 60 * 60 * 1000;

			const pullRequestNodeA = pullRequestNode(new Date((new Date().getTime()) - HALF_MONTH_IN_MILLISEC).toISOString());
			const pullRequestNodeB = pullRequestNode(new Date((new Date().getTime()) - ONE_MONTH_IN_MILLISEC).toISOString());
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
										node: pullRequestNodeA
									},
									{
										node: pullRequestNodeB
									}
								]
							}
						}
					}
				});

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
				5,
				{
					jiraHost,
					installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
					commitsFromDate: new Date((new Date().getTime()) - SIX_MONTH_IN_MILLISEC).toISOString()
				}
			);

			expect(result.edges?.length).toEqual(2);
		});


		it("should stop fetching pages once date limit is reached", async () => {

			const HALF_MONTH_IN_MILLISEC = 1 * 15 * 24 * 60 * 60 * 1000;
			const ONE_MONTH_IN_MILLISEC = 1 * 31 * 24 * 60 * 60 * 1000;
			const SIX_MONTH_IN_MILLISEC = 6 * 31 * 24 * 60 * 60 * 1000;

			const pullRequestNodeA = pullRequestNode(new Date((new Date().getTime()) - HALF_MONTH_IN_MILLISEC).toISOString());
			const pullRequestNodeB = pullRequestNode(new Date((new Date().getTime()) - SIX_MONTH_IN_MILLISEC).toISOString());
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
										node: pullRequestNodeA
									},
									{
										node: pullRequestNodeB
									}
								]
							}
						}
					}
				});

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
				1,
				{
					jiraHost,
					installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
					commitsFromDate: new Date((new Date().getTime()) - ONE_MONTH_IN_MILLISEC).toISOString()
				}
			);

			expect(result.edges?.length).toEqual(1);
		});

		it("should only fetch PRS within the target date range", async () => {

			const HALF_MONTH_IN_MILLISEC = 1 * 15 * 24 * 60 * 60 * 1000;
			const ONE_MONTH_IN_MILLISEC = 1 * 31 * 24 * 60 * 60 * 1000;
			const SIX_MONTH_IN_MILLISEC = 6 * 31 * 24 * 60 * 60 * 1000;
			const NINE_MONTH_IN_MILLISEC = 12 * 31 * 24 * 60 * 60 * 1000;

			const pullRequestNodeA = pullRequestNode(new Date((new Date().getTime()) - HALF_MONTH_IN_MILLISEC).toISOString());
			const pullRequestNodeB = pullRequestNode(new Date((new Date().getTime()) - ONE_MONTH_IN_MILLISEC).toISOString());
			const pullRequestNodeC = pullRequestNode(new Date((new Date().getTime()) - NINE_MONTH_IN_MILLISEC).toISOString());
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
										node: pullRequestNodeA
									},
									{
										node: pullRequestNodeB
									},
									{
										node: pullRequestNodeC
									}
								]
							}
						}
					}
				});

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
				50,
				{
					jiraHost,
					installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
					commitsFromDate: new Date((new Date().getTime()) - SIX_MONTH_IN_MILLISEC).toISOString()
				}
			);

			expect(result.edges?.length).toEqual(2);
		});

		it("should return everything when no commitsincedate is provided", async () => {

			const HALF_MONTH_IN_MILLISEC = 1 * 15 * 24 * 60 * 60 * 1000;
			const ONE_MONTH_IN_MILLISEC = 1 * 31 * 24 * 60 * 60 * 1000;

			const pullRequestNodeA = pullRequestNode(new Date((new Date().getTime()) - HALF_MONTH_IN_MILLISEC).toISOString());
			const pullRequestNodeB = pullRequestNode(new Date((new Date().getTime()) - ONE_MONTH_IN_MILLISEC).toISOString());
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
										node: pullRequestNodeA
									},
									{
										node: pullRequestNodeB
									}
								]
							}
						}
					}
				});

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
				1,
				{
					jiraHost,
					installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID
				}
			);

			expect(result.edges?.length).toEqual(2);
		});

		it("should return nothing when pulls are outside commitsince", async () => {

			const HALF_MONTH_IN_MILLISEC = 1 * 15 * 24 * 60 * 60 * 1000;
			const ONE_MONTH_IN_MILLISEC = 1 * 31 * 24 * 60 * 60 * 1000;
			const NINE_MONTH_IN_MILLISEC = 1 * 31 * 24 * 60 * 60 * 1000;

			const pullRequestNodeA = pullRequestNode(new Date((new Date().getTime()) - NINE_MONTH_IN_MILLISEC).toISOString());
			const pullRequestNodeB = pullRequestNode(new Date((new Date().getTime()) - ONE_MONTH_IN_MILLISEC).toISOString());
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
										node: pullRequestNodeA
									},
									{
										node: pullRequestNodeB
									}
								]
							}
						}
					}
				});

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
				1,
				{
					jiraHost,
					installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
					commitsFromDate: new Date((new Date().getTime()) - HALF_MONTH_IN_MILLISEC).toISOString()
				}
			);

			expect(result.edges?.length).toEqual(0);
		});

	});
});

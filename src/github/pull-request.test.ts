/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";

import pullRequestBasic from "fixtures/pull-request-basic.json";
import pullRequestRemoveKeys from "fixtures/pull-request-remove-keys.json";
import pullRequestNullRepo from "fixtures/pull-request-null-repo.json";
import pullRequestChangesWithBranch from "fixtures/pull-request-test-changes-with-branch.json";

import pullRequestTriggeredByBot from "fixtures/pull-request-triggered-by-bot.json";
import { pullRequestWebhookHandler } from "~/src/github/pull-request";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { getLogger } from "config/logger";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { createWebhookApp, WebhookApp } from "test/utils/create-webhook-app";

jest.mock("config/feature-flags");

describe("Pull Request Webhook", () => {
	let app: WebhookApp;
	const gitHubInstallationId = 1234;
	const issueKeys = ["TEST-123", "TEST-321", "TEST-124"];

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
			html_url: "https://github.com/test-repo-owner/test-repo-name/pull/1#pullrequestreview-80",
			pull_request_url: "https://api.github.com/repos/test-repo-owner/test-repo-name/pulls/1",
			_links: {
				html: {
					href: "https://github.com/test-repo-owner/test-repo-name/pull/1#pullrequestreview-80"
				},
				pull_request: {
					href: "https://api.github.com/repos/test-repo-owner/test-repo-name/pulls/1"
				}
			},
			submitted_at: "2019-11-17T17:43:43Z",
			commit_id: "ecdd80bb57125d7ba9641ffaa4d7d2c19d3f3091",
			author_association: "COLLABORATOR"
		}
	];

	beforeEach(async () => {
		app = await createWebhookApp();
		const clientKey = "client-key";
		await Installation.create({
			clientKey,
			encryptedSharedSecret: "shared-secret",
			jiraHost
		});
		await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: clientKey
		});

	});

	it("should have reviewers on pull request action", async () => {
		githubUserTokenNock(gitHubInstallationId);
		githubNock.get("/users/test-pull-request-user-login")
			.reply(200, {
				login: "test-pull-request-author-login",
				avatar_url: "test-pull-request-author-avatar",
				html_url: "test-pull-request-author-url"
			});

		githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/reviews")
			.reply(200, reviewsPayload);

		githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/requested_reviewers")
			.reply(200, {
				users: [{
					...reviewsPayload[0].user,
					login: "requested"
				}],
				teams: []
			});

		githubNock.get("/users/test-pull-request-reviewer-login")
			.reply(200, {
				login: "test-pull-request-reviewer-login",
				avatar_url: "test-pull-request-reviewer-avatar",
				html_url: "test-pull-request-reviewer-url",
				email: "test-pull-request-reviewer-login@email.test"
			});

		githubNock.patch("/repos/test-repo-owner/test-repo-name/issues/1", {
			body: `[TEST-124] body of the test pull request.\n\n[TEST-124]: ${jiraHost}/browse/TEST-124`
		}).reply(200);

		jiraNock
			.get("/rest/api/latest/issue/TEST-124?fields=summary")
			.reply(200, {
				key: "TEST-124",
				fields: {
					summary: "Example Issue"
				}
			});

		jiraNock.post("/rest/devinfo/0.10/bulk", {
			preventTransitions: false,
			operationType: "NORMAL",
			repositories: [
				{
					id:"321806393",
					url: "test-pull-request-base-url",
					name: "bgvozdev/day2-test-empy-repo-before-connect",
					branches: [
						{
							createPullRequestUrl: "test-pull-request-head-url/compare/TEST-321-test-pull-request-head-ref?title=TEST-321-test-pull-request-head-ref&quick_pull=1",
							lastCommit: {
								author: {
									avatar: "https://github.com/ghost.png",
									name: "Deleted User",
									email: "deleted@noreply.user.github.com",
									url: "https://github.com/ghost"
								},
								authorTimestamp: "test-pull-request-update-time",
								displayId: "test-p",
								fileCount: 0,
								hash: "test-pull-request-sha",
								id: "test-pull-request-sha",
								issueKeys,
								message: "n/a",
								updateSequenceId: 12345678,
								url: "test-pull-request-head-url/commit/test-pull-request-sha"
							},
							id: "TEST-321-test-pull-request-head-ref",
							issueKeys,
							name: "TEST-321-test-pull-request-head-ref",
							url: "test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref",
							updateSequenceId: 12345678
						}
					],
					pullRequests: [
						{
							author: {
								avatar: "test-pull-request-author-avatar",
								name: "test-pull-request-author-login",
								email: "test-pull-request-author-login@noreply.user.github.com",
								url: "test-pull-request-author-url"
							},
							commentCount: "test-pull-request-comment-count",
							destinationBranch: "test-pull-request-base-ref",
							destinationBranchUrl: "test-pull-request-base-url/tree/test-pull-request-base-ref",
							displayId: "#1",
							id: 1,
							issueKeys,
							lastUpdate: "test-pull-request-update-time",
							reviewers: [
								{
									avatar: "test-pull-request-reviewer-avatar",
									name: "requested",
									email: "requested@noreply.user.github.com",
									url: "https://github.com/reviewer",
									approvalStatus: "UNAPPROVED"
								},
								{
									avatar: "test-pull-request-reviewer-avatar",
									name: "test-pull-request-reviewer-login",
									email: "test-pull-request-reviewer-login@email.test",
									url: "https://github.com/reviewer",
									approvalStatus: "APPROVED"
								}
							],
							sourceBranch: "TEST-321-test-pull-request-head-ref",
							sourceBranchUrl: "test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref",
							status: "OPEN",
							timestamp: "test-pull-request-update-time",
							title: "[TEST-123] Test pull request.",
							url: "test-pull-request-url",
							updateSequenceId: 12345678
						}
					],
					updateSequenceId: 12345678
				}
			],
			properties: { installationId: 1234 }
		}).reply(200);

		mockSystemTime(12345678);

		await expect(app.receive(pullRequestBasic as any)).toResolve();
	});


	it("no Write perms case should be tolerated", async () => {
		githubUserTokenNock(gitHubInstallationId);
		githubNock.get("/users/test-pull-request-user-login")
			.reply(200, {
				login: "test-pull-request-author-login",
				avatar_url: "test-pull-request-author-avatar",
				html_url: "test-pull-request-author-url"
			});

		githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/reviews")
			.reply(200, reviewsPayload);

		githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/requested_reviewers")
			.reply(200, {
				users: [],
				teams: []
			});

		githubNock.get("/users/test-pull-request-reviewer-login")
			.reply(200, {
				login: "test-pull-request-reviewer-login",
				avatar_url: "test-pull-request-reviewer-avatar",
				html_url: "test-pull-request-reviewer-url",
				email: "test-pull-request-reviewer-login@email.test"
			});

		githubNock.patch("/repos/test-repo-owner/test-repo-name/issues/1", {
			body: `[TEST-124] body of the test pull request.\n\n[TEST-124]: ${jiraHost}/browse/TEST-124`
		}).reply(401);

		jiraNock
			.get("/rest/api/latest/issue/TEST-124?fields=summary")
			.reply(200, {
				key: "TEST-124",
				fields: {
					summary: "Example Issue"
				}
			});

		jiraNock.post("/rest/devinfo/0.10/bulk").reply(200);

		mockSystemTime(12345678);

		await expect(app.receive(pullRequestBasic as any)).toResolve();
	});

	it("should delete the reference to a pull request when issue keys are removed from the title for cloud", async () => {
		const { repository, pull_request: pullRequest } = pullRequestRemoveKeys.payload;

		jiraNock
			.delete(`/rest/devinfo/0.10/repository/${repository.id}/pull_request/${pullRequest.number}`)
			.query({ _updateSequenceId: 12345678 })
			.reply(200);

		mockSystemTime(12345678);

		await expect(app.receive(pullRequestRemoveKeys as any)).toResolve();
	});

	it("should delete the reference to a pull request when issue keys are removed from the title for server", async () => {

		mockSystemTime(12345678);

		const { subscription, gitHubServerApp } = await new DatabaseStateCreator()
			.forServer()
			.create();

		const jiraClientDevinfoPullRequestDeleteMock = jest.fn();

		await pullRequestWebhookHandler(new WebhookContext({
			id: "my-id",
			name: pullRequestRemoveKeys.name,
			payload: pullRequestRemoveKeys.payload,
			log: getLogger("test"),
			gitHubAppConfig: {
				gitHubAppId: gitHubServerApp!.id,
				appId: gitHubServerApp!.appId,
				clientId: gitHubServerApp!.gitHubClientId,
				gitHubBaseUrl: gitHubServerApp!.gitHubBaseUrl,
				gitHubApiUrl: gheApiUrl,
				uuid: gitHubServerApp!.uuid
			}
		}), {
			baseURL: jiraHost,
			devinfo: {
				pullRequest: {
					delete: jiraClientDevinfoPullRequestDeleteMock
				}
			}
		}, jest.fn(), gitHubInstallationId, subscription);
		expect(jiraClientDevinfoPullRequestDeleteMock.mock.calls[0][0]).toEqual("6769746875626d79646f6d61696e636f6d-test-repo-id");
	});

	it("should not update the Jira issue if the source repo of a pull_request was deleted", async () => {
		mockSystemTime(12345678);

		await expect(app.receive(pullRequestNullRepo as any)).toResolve();
	});

	it("will not delete references if a branch still has an issue key", async () => {

		githubUserTokenNock(gitHubInstallationId);

		githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/reviews")
			.reply(200, reviewsPayload);

		githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/requested_reviewers")
			.reply(200, {
				users: [],
				teams: []
			});

		githubNock.get("/users/test-pull-request-user-login")
			.twice()
			.reply(200, {
				login: "test-pull-request-author-login",
				avatar_url: "test-pull-request-author-avatar",
				html_url: "test-pull-request-author-url"
			});

		mockSystemTime(12345678);

		await expect(app.receive(pullRequestChangesWithBranch as any)).toResolve();
	});

	describe("Trigged by Bot", () => {

		it("should update the Jira issue with the linked GitHub pull_request if PR opened action was triggered by bot", async () => {
			githubUserTokenNock(gitHubInstallationId);

			githubNock.get("/users/test-pull-request-user-login")
				.reply(200, {
					login: "test-pull-request-author-login",
					avatar_url: "test-pull-request-author-avatar",
					html_url: "test-pull-request-author-url"
				});

			githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/reviews")
				.reply(200, reviewsPayload);

			githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/requested_reviewers")
				.reply(200, {
					users: [],
					teams: []
				});

			githubNock.get("/users/test-pull-request-reviewer-login")
				.reply(200, {
					login: "test-pull-request-reviewer-login",
					avatar_url: "test-pull-request-reviewer-avatar",
					html_url: "test-pull-request-reviewer-url",
					email: "test-pull-request-reviewer-login@email.test"
				});

			githubNock
				.patch("/repos/test-repo-owner/test-repo-name/issues/1", {
					body: `[TEST-124] body of the test pull request.\n\n[TEST-124]: ${jiraHost}/browse/TEST-124`
				})
				.reply(200);

			jiraNock
				.get("/rest/api/latest/issue/TEST-124?fields=summary")
				.reply(200, {
					key: "TEST-124",
					fields: {
						summary: "Example Issue"
					}
				});

			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
				operationType: "NORMAL",
				repositories:
					[
						{
							id:"321806393",
							name: "bgvozdev/day2-test-empy-repo-before-connect",
							url: "test-pull-request-base-url",
							branches:
								[
									{
										createPullRequestUrl: "test-pull-request-head-url/compare/TEST-321-test-pull-request-head-ref?title=TEST-321-test-pull-request-head-ref&quick_pull=1",
										lastCommit:
											{
												author:
													{
														avatar: "https://github.com/ghost.png",
														name: "Deleted User",
														email: "deleted@noreply.user.github.com",
														url: "https://github.com/ghost"
													},
												authorTimestamp: "test-pull-request-update-time",
												displayId: "test-p",
												fileCount: 0,
												hash: "test-pull-request-sha",
												id: "test-pull-request-sha",
												issueKeys,
												message: "n/a",
												updateSequenceId: 12345678,
												url: "test-pull-request-head-url/commit/test-pull-request-sha"
											},
										id: "TEST-321-test-pull-request-head-ref",
										issueKeys,
										name: "TEST-321-test-pull-request-head-ref",
										url: "test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref",
										updateSequenceId: 12345678
									}
								],
							pullRequests:
								[
									{
										author:
											{
												avatar: "test-pull-request-author-avatar",
												name: "test-pull-request-author-login",
												email: "test-pull-request-author-login@noreply.user.github.com",
												url: "test-pull-request-author-url"
											},
										commentCount: "test-pull-request-comment-count",
										destinationBranch: "test-pull-request-base-ref",
										destinationBranchUrl: "test-pull-request-base-url/tree/test-pull-request-base-ref",
										displayId: "#1",
										id: 1,
										issueKeys,
										lastUpdate: "test-pull-request-update-time",
										reviewers:
											[
												{
													avatar: "test-pull-request-reviewer-avatar",
													name: "test-pull-request-reviewer-login",
													email: "test-pull-request-reviewer-login@email.test",
													url: "https://github.com/reviewer",
													approvalStatus: "APPROVED"
												}
											],
										sourceBranch: "TEST-321-test-pull-request-head-ref",
										sourceBranchUrl: "test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref",
										status: "OPEN",
										timestamp: "test-pull-request-update-time",
										title: "[TEST-123] Test pull request.",
										url: "test-pull-request-url",
										updateSequenceId: 12345678
									}
								],
							updateSequenceId: 12345678
						}
					],
				properties:
					{
						installationId: 1234
					}
			}).reply(200);

			mockSystemTime(12345678);

			await expect(app.receive(pullRequestTriggeredByBot[0] as any)).toResolve();
		});

		it("should update the Jira issue with the linked GitHub pull_request if PR closed action was triggered by bot", async () => {

			githubUserTokenNock(gitHubInstallationId);

			githubNock.get("/users/test-pull-request-user-login")
				.reply(200, {
					login: "test-pull-request-author-login",
					avatar_url: "test-pull-request-author-avatar",
					html_url: "test-pull-request-author-url"
				});

			githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/reviews")
				.reply(200, reviewsPayload);

			githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/requested_reviewers")
				.reply(200, {
					users: [],
					teams: []
				});

			githubNock.get("/users/test-pull-request-reviewer-login")
				.reply(200, {
					login: "test-pull-request-reviewer-login",
					avatar_url: "test-pull-request-reviewer-avatar",
					html_url: "test-pull-request-reviewer-url",
					email: "test-pull-request-reviewer-login@email.test"
				});

			githubNock.patch("/repos/test-repo-owner/test-repo-name/issues/1", {
				body: `[TEST-124] body of the test pull request.\n\n[TEST-124]: ${jiraHost}/browse/TEST-124`
			}).reply(200);

			jiraNock.get("/rest/api/latest/issue/TEST-124?fields=summary")
				.reply(200, {
					key: "TEST-124",
					fields: {
						summary: "Example Issue"
					}
				});

			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
				operationType: "NORMAL",
				repositories: [
					{
						id:"321806393",
						name: "bgvozdev/day2-test-empy-repo-before-connect",
						url: "test-pull-request-base-url",
						branches: [],
						pullRequests: [
							{
								author: {
									avatar: "test-pull-request-author-avatar",
									name: "test-pull-request-author-login",
									email: "test-pull-request-author-login@noreply.user.github.com",
									url: "test-pull-request-author-url"
								},
								commentCount: "test-pull-request-comment-count",
								destinationBranch: "test-pull-request-base-ref",
								destinationBranchUrl: "test-pull-request-base-url/tree/test-pull-request-base-ref",
								displayId: "#1",
								id: 1,
								issueKeys,
								lastUpdate: "test-pull-request-update-time",
								reviewers: [
									{
										avatar: "test-pull-request-reviewer-avatar",
										name: "test-pull-request-reviewer-login",
										email: "test-pull-request-reviewer-login@email.test",
										url: "https://github.com/reviewer",
										approvalStatus: "APPROVED"
									}
								],
								sourceBranch: "TEST-321-test-pull-request-head-ref",
								sourceBranchUrl: "test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref",
								status: "MERGED",
								timestamp: "test-pull-request-update-time",
								title: "[TEST-123] Test pull request.",
								url: "test-pull-request-url",
								updateSequenceId: 12345678
							}
						],
						updateSequenceId: 12345678
					}
				],
				properties: { installationId: 1234 }
			}).reply(200);

			mockSystemTime(12345678);

			await expect(app.receive(pullRequestTriggeredByBot[1] as any)).toResolve();
		});

		it("should update the Jira issue with the linked GitHub pull_request if PR reopened action was triggered by bot", async () => {

			githubUserTokenNock(gitHubInstallationId);

			githubNock.get("/users/test-pull-request-user-login")
				.twice()
				.reply(200, {
					login: "test-pull-request-author-login",
					avatar_url: "test-pull-request-author-avatar",
					html_url: "test-pull-request-author-url"
				});

			githubNock.patch("/repos/test-repo-owner/test-repo-name/issues/1", {
				body: `[TEST-124] body of the test pull request.\n\n[TEST-124]: ${jiraHost}/browse/TEST-124`
			}).reply(200);

			githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/reviews")
				.reply(200, reviewsPayload);

			githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/requested_reviewers")
				.reply(200, {
					users: [],
					teams: []
				});

			githubNock.get("/users/test-pull-request-reviewer-login")
				.reply(200, {
					login: "test-pull-request-reviewer-login",
					avatar_url: "test-pull-request-reviewer-avatar",
					html_url: "test-pull-request-reviewer-url",
					email: "test-pull-request-reviewer-login@email.test"
				});

			jiraNock.get("/rest/api/latest/issue/TEST-124?fields=summary")
				.reply(200, {
					key: "TEST-124",
					fields: {
						summary: "Example Issue"
					}
				});

			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
				operationType: "NORMAL",
				repositories:
					[
						{
							id:"321806393",
							name: "bgvozdev/day2-test-empy-repo-before-connect",
							url: "test-pull-request-base-url",
							branches:
								[
									{
										createPullRequestUrl: "test-pull-request-head-url/compare/TEST-321-test-pull-request-head-ref?title=TEST-321-test-pull-request-head-ref&quick_pull=1",
										lastCommit:
											{
												author:
													{
														avatar: "test-pull-request-author-avatar",
														name: "test-pull-request-author-login",
														email: "test-pull-request-author-login@noreply.user.github.com",
														url: "test-pull-request-author-url"
													},
												authorTimestamp: "test-pull-request-update-time",
												displayId: "test-p",
												fileCount: 0,
												hash: "test-pull-request-sha",
												id: "test-pull-request-sha",
												issueKeys,
												message: "n/a",
												updateSequenceId: 12345678,
												url: "test-pull-request-head-url/commit/test-pull-request-sha"
											},
										id: "TEST-321-test-pull-request-head-ref",
										issueKeys,
										name: "TEST-321-test-pull-request-head-ref",
										url: "test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref",
										updateSequenceId: 12345678
									}
								],
							pullRequests:
								[
									{
										author:
											{
												avatar: "test-pull-request-author-avatar",
												name: "test-pull-request-author-login",
												email: "test-pull-request-author-login@noreply.user.github.com",
												url: "test-pull-request-author-url"
											},
										commentCount: "test-pull-request-comment-count",
										destinationBranch: "test-pull-request-base-ref",
										destinationBranchUrl: "test-pull-request-base-url/tree/test-pull-request-base-ref",
										displayId: "#1",
										id: 1,
										issueKeys,
										lastUpdate: "test-pull-request-update-time",
										reviewers:
											[
												{
													avatar: "test-pull-request-reviewer-avatar",
													name: "test-pull-request-reviewer-login",
													email: "test-pull-request-reviewer-login@email.test",
													url: "https://github.com/reviewer",
													approvalStatus: "APPROVED"
												}
											],
										sourceBranch: "TEST-321-test-pull-request-head-ref",
										sourceBranchUrl: "test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref",
										status: "OPEN",
										timestamp: "test-pull-request-update-time",
										title: "[TEST-123] Test pull request.",
										url: "test-pull-request-url",
										updateSequenceId: 12345678
									}
								],
							updateSequenceId: 12345678
						}
					],
				properties:
					{
						installationId: 1234
					}
			}).reply(200);

			mockSystemTime(12345678);

			await expect(app.receive(pullRequestTriggeredByBot[2] as any)).toResolve();
		});
	});
});

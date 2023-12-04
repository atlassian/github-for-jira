/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import nock from "nock";
import pullRequestMultipleInvalidIssues from "../fixtures/pull-request-multiple-invalid-issue-key.json";
import pullRequestBasic from "../fixtures/pull-request-basic.json";
import { createWebhookApp } from "test/utils/create-webhook-app";

jest.mock("config/feature-flags");

const githubPullReviewsResponse = [
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

const githubRequestUserLoginResponse = {
	login: "test-pull-request-author-login",
	avatar_url: "test-pull-request-author-avatar",
	html_url: "test-pull-request-author-url"
};

const jiraMatchingIssuesKeysBulkResponse = {
	preventTransitions: false,
	operationType: "NORMAL",
	repositories: [
		{
			id:"321806393",
			name: "bgvozdev/day2-test-empy-repo-before-connect",
			url: "test-pull-request-base-url",
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
						issueKeys: ["TEST-123", "TEST-222", "TEST-321", "TEST-124", "TEST-223"],
						message: "n/a",
						updateSequenceId: 12345678,
						url: "test-pull-request-head-url/commit/test-pull-request-sha"
					},
					id: "TEST-321-test-pull-request-head-ref",
					issueKeys: ["TEST-123", "TEST-222", "TEST-321", "TEST-124", "TEST-223"],
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
					issueKeys: ["TEST-123", "TEST-222", "TEST-321", "TEST-124", "TEST-223"],
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
					status: "OPEN",
					timestamp: "test-pull-request-update-time",
					title: "[TEST-123] [TEST-222] Test pull request.",
					url: "test-pull-request-url",
					updateSequenceId: 12345678
				}
			],
			updateSequenceId: 12345678
		}
	],
	properties: { installationId: 1234 }
};

const jiraMultipleJiraBulkResponse = {
	preventTransitions: false,
	operationType: "NORMAL",
	repositories: [
		{
			id:"321806393",
			name: "bgvozdev/day2-test-empy-repo-before-connect",
			url: "test-pull-request-base-url",
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
						issueKeys: ["TEST-123", "TEST-321", "TEST-124"],
						message: "n/a",
						updateSequenceId: 12345678,
						url: "test-pull-request-head-url/commit/test-pull-request-sha"
					},
					id: "TEST-321-test-pull-request-head-ref",
					issueKeys: ["TEST-123", "TEST-321", "TEST-124"],
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
					issueKeys: ["TEST-123", "TEST-321", "TEST-124"],
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
};

describe("multiple Jira instances", () => {
	let app: any;
	const gitHubInstallationId = 1234;
	const jira2Host = "https://test2-atlassian-instance.atlassian.net";
	const jira2Nock = nock(jira2Host);

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
		await Installation.create({
			clientKey,
			encryptedSharedSecret: "shared-secret",
			jiraHost: jira2Host
		});
		await Subscription.create({
			gitHubInstallationId,
			jiraHost: jira2Host,
			jiraClientKey: clientKey
		});

	});

	it("should not linkify issue keys for jira instance that has matching issues", async () => {

		githubUserTokenNock(gitHubInstallationId);

		githubNock.get("/users/test-pull-request-user-login")
			.times(2)
			.reply(200, githubRequestUserLoginResponse);

		githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/reviews")
			.times(2)
			.reply(200, githubPullReviewsResponse);

		githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/requested_reviewers")
			.times(2)
			.reply(200, { users: [], teams: [] });

		githubNock.get("/users/test-pull-request-reviewer-login")
			.times(2)
			.reply(200, {
				login: "test-pull-request-reviewer-login",
				avatar_url: "test-pull-request-reviewer-avatar",
				html_url: "test-pull-request-reviewer-url",
				email: "test-pull-request-reviewer-login@email.test"
			});

		githubNock.patch("/repos/test-repo-owner/test-repo-name/issues/1", {
			body: `[TEST-124] [TEST-223] body of the test pull request.\n\n[TEST-223]: ${jira2Host}/browse/TEST-223`
		}).reply(200);

		jiraNock
			.get("/rest/api/latest/issue/TEST-124?fields=summary")
			.reply(401);

		jiraNock
			.get("/rest/api/latest/issue/TEST-223?fields=summary")
			.reply(401);

		jira2Nock
			.get("/rest/api/latest/issue/TEST-124?fields=summary")
			.reply(401);

		jira2Nock
			.get("/rest/api/latest/issue/TEST-223?fields=summary")
			.reply(200, {
				key: "TEST-223",
				fields: {
					summary: "Example Issue"
				}
			});

		jiraNock.post("/rest/devinfo/0.10/bulk", jiraMatchingIssuesKeysBulkResponse).reply(200);
		jira2Nock.post("/rest/devinfo/0.10/bulk", jiraMatchingIssuesKeysBulkResponse).reply(200);
		mockSystemTime(12345678);

		await expect(app.receive(pullRequestMultipleInvalidIssues as any)).toResolve();
	});

	it("should associate PR with to multiple jira with same issue keys", async () => {

		githubUserTokenNock(gitHubInstallationId);

		githubNock.get("/users/test-pull-request-user-login")
			.twice()
			.reply(200, githubRequestUserLoginResponse);

		githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/reviews")
			.twice()
			.reply(200, githubPullReviewsResponse);

		githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/requested_reviewers")
			.twice()
			.reply(200, { users: [], teams: [] });

		githubNock.get("/users/test-pull-request-reviewer-login")
			.times(2)
			.reply(200, {
				login: "test-pull-request-reviewer-login",
				avatar_url: "test-pull-request-reviewer-avatar",
				html_url: "test-pull-request-reviewer-url",
				email: "test-pull-request-reviewer-login@email.test"
			});

		githubNock.patch("/repos/test-repo-owner/test-repo-name/issues/1", {
			body: `[TEST-124] body of the test pull request.\n\n[TEST-124]: ${jiraHost}/browse/TEST-124`
		}).reply(200);

		githubNock
			.patch("/repos/test-repo-owner/test-repo-name/issues/1", {
				body: `[TEST-124] body of the test pull request.\n\n[TEST-124]: ${jira2Host}/browse/TEST-124`
			}).reply(200);

		jiraNock
			.get("/rest/api/latest/issue/TEST-124?fields=summary")
			.reply(200, {
				key: "TEST-124",
				fields: {
					summary: "Example Issue"
				}
			});
		jira2Nock
			.get("/rest/api/latest/issue/TEST-124?fields=summary")
			.reply(200, {
				key: "TEST-124",
				fields: {
					summary: "Example Issue"
				}
			});

		jiraNock.post("/rest/devinfo/0.10/bulk", jiraMultipleJiraBulkResponse).reply(200);
		jira2Nock.post("/rest/devinfo/0.10/bulk", jiraMultipleJiraBulkResponse).reply(200);

		mockSystemTime(12345678);

		await expect(app.receive(pullRequestBasic as any)).toResolve();
	});
});

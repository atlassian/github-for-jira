/* eslint-disable @typescript-eslint/no-explicit-any */
import { transformPullRequest } from "./transform-pull-request";
import transformPullRequestList from "fixtures/api/transform-pull-request-list.json";
import reviewersListNoUser from "fixtures/api/pull-request-reviewers-no-user.json";
import reviewersListHasUser from "fixtures/api/pull-request-reviewers-has-user.json";
import multipleReviewersWithMultipleReviews from "fixtures/api/pull-request-has-multiple-reviewers-with-multiple-reviews.json";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { getInstallationId } from "~/src/github/client/installation-id";
import { getLogger } from "config/logger";
import _ from "lodash";

describe("pull_request transform", () => {
	const gitHubInstallationId = 100403908;
	let client: GitHubInstallationClient;

	beforeEach(() => {
		mockSystemTime(12345678);
		client = new GitHubInstallationClient(getInstallationId(gitHubInstallationId), gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"));
	});

	it("should not contain branches on the payload if pull request status is closed.", async () => {
		const fixture = transformPullRequestList[0];
		fixture.title = "[TES-123] Branch payload Test";

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/users/${fixture.user.login}`)
			.reply(200, {
				...fixture.user,
				name: "Some User Name"
			});

		const data = await transformPullRequest(client, fixture as any);

		const { updated_at, title } = fixture;

		expect(data).toMatchObject({
			id: "100403908",
			name: "integrations/test",
			pullRequests: [
				{
					author: {
						avatar: "https://avatars0.githubusercontent.com/u/173?v=4",
						name: "Some User Name",
						url: "https://api.github.com/users/bkeepers"
					},
					destinationBranch: "devel",
					destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
					displayId: "#51",
					id: 51,
					issueKeys: ["TES-123"],
					lastUpdate: updated_at,
					sourceBranch: "use-the-force",
					sourceBranchUrl:
						"https://github.com/integrations/test/tree/use-the-force",
					status: "MERGED",
					timestamp: updated_at,
					title: title,
					url: "https://github.com/integrations/test/pull/51",
					updateSequenceId: 12345678
				}
			],
			url: "https://github.com/integrations/test",
			updateSequenceId: 12345678
		});
	});

	it("should contain branches on the payload if pull request status is different than closed.", async () => {
		const pullRequestList = Object.assign({},
			transformPullRequestList
		);

		const fixture = pullRequestList[1];
		fixture.title = "[TES-123] Branch payload Test";

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/users/${fixture.user.login}`)
			.reply(200, {
				...fixture.user,
				name: "Some User Name"
			});

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/users/${fixture.head.user.login}`)
			.reply(200, {
				...fixture.head.user,
				name: "Last Commit User Name"
			});

		const data = await transformPullRequest(client, fixture as any);

		const { updated_at, title } = fixture;

		expect(data).toMatchObject({
			id: "100403908",
			name: "integrations/test",
			pullRequests: [
				{
					author: {
						avatar: "https://avatars0.githubusercontent.com/u/173?v=4",
						name: "Some User Name",
						url: "https://api.github.com/users/bkeepers"
					},
					destinationBranch: "devel",
					destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
					displayId: "#51",
					id: 51,
					issueKeys: ["TES-123"],
					lastUpdate: updated_at,
					sourceBranch: "use-the-force",
					sourceBranchUrl:
						"https://github.com/integrations/test/tree/use-the-force",
					status: "OPEN",
					timestamp: updated_at,
					title: title,
					url: "https://github.com/integrations/test/pull/51",
					updateSequenceId: 12345678
				}
			],
			branches: [
				{
					createPullRequestUrl:
						"https://github.com/integrations/test/compare/use-the-force?title=TES-123-use-the-force&quick_pull=1",
					id: "use-the-force",
					issueKeys: ["TES-123"],
					lastCommit: {
						author: {
							avatar: "https://avatars3.githubusercontent.com/u/31044959?v=4",
							name: "Last Commit User Name",
							url: "https://github.com/integrations"
						},
						authorTimestamp: "2018-05-04T14:06:56Z",
						displayId: "09ca66",
						fileCount: 0,
						hash: "09ca669e4b5ff78bfa6a9fee74c384812e1f96dd",
						id: "09ca669e4b5ff78bfa6a9fee74c384812e1f96dd",
						issueKeys: ["TES-123"],
						message: "n/a",
						updateSequenceId: 12345678,
						url: "https://github.com/integrations/test/commit/09ca669e4b5ff78bfa6a9fee74c384812e1f96dd"
					},
					name: "use-the-force",
					updateSequenceId: 12345678,
					url: "https://github.com/integrations/test/tree/use-the-force"
				}
			],
			url: "https://github.com/integrations/test",
			updateSequenceId: 12345678
		});
	});

	it("should not contain createPullRequestUrl on the payload if length > 2000", async () => {
		const pullRequestList = Object.assign({},
			transformPullRequestList
		);

		const fixture = pullRequestList[2];
		fixture.title = "[TEST-0] Branch payload with loads of issue keys Test";

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/users/${fixture.user.login}`)
			.reply(200, {
				...fixture.user,
				name: "Some User Name"
			});

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/users/${fixture.head.user.login}`)
			.reply(200, {
				...fixture.head.user,
				name: "Last Commit User Name"
			});

		const data = await transformPullRequest(client, fixture as any);

		const { updated_at, title } = fixture;

		const issueKeys = Array.from(new Array(250)).map((_, i) => `TEST-${i+1}`);

		expect(data).toMatchObject({
			id: "100403908",
			name: "integrations/test",
			pullRequests: [
				{
					author: {
						avatar: "https://avatars0.githubusercontent.com/u/173?v=4",
						name: "Some User Name",
						url: "https://api.github.com/users/bkeepers"
					},
					destinationBranch: "devel",
					destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
					displayId: "#51",
					id: 51,
					issueKeys,
					lastUpdate: updated_at,
					sourceBranch: "use-the-force",
					sourceBranchUrl:
						"https://github.com/integrations/test/tree/use-the-force",
					status: "OPEN",
					timestamp: updated_at,
					title: title,
					url: "https://github.com/integrations/test/pull/51",
					updateSequenceId: 12345678
				}
			],
			branches: [
				{
					id: "use-the-force",
					issueKeys,
					lastCommit: {
						author: {
							avatar: "https://avatars3.githubusercontent.com/u/31044959?v=4",
							name: "Last Commit User Name",
							url: "https://github.com/integrations"
						},
						authorTimestamp: "2018-05-04T14:06:56Z",
						displayId: "09ca66",
						fileCount: 0,
						hash: "09ca669e4b5ff78bfa6a9fee74c384812e1f96dd",
						id: "09ca669e4b5ff78bfa6a9fee74c384812e1f96dd",
						issueKeys,
						message: "n/a",
						updateSequenceId: 12345678,
						url: "https://github.com/integrations/test/commit/09ca669e4b5ff78bfa6a9fee74c384812e1f96dd"
					},
					name: "use-the-force",
					updateSequenceId: 12345678,
					url: "https://github.com/integrations/test/tree/use-the-force"
				}
			],
			url: "https://github.com/integrations/test",
			updateSequenceId: 12345678
		});
	});

	it("should transform deleted author and reviewers without exploding", async () => {
		const pullRequestList = Object.assign({},
			transformPullRequestList
		);

		const fixture = pullRequestList[0];
		fixture.title = "[TEST-1] Branch payload with loads of issue keys Test";
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		fixture.user = null;

		const data = await transformPullRequest(client, fixture as any, reviewersListNoUser as any);

		const { updated_at, title } = fixture;

		expect(data).toMatchObject({
			id: "100403908",
			name: "integrations/test",
			pullRequests: [
				{
					author: {
						avatar: "https://github.com/ghost.png",
						name: "Deleted User",
						url: "https://github.com/ghost"
					},
					destinationBranch: "devel",
					destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
					displayId: "#51",
					id: 51,
					issueKeys: ["TEST-1"],
					lastUpdate: updated_at,
					reviewers: [
						{
							avatar: "https://github.com/ghost.png",
							name: "Deleted User",
							email: "deleted@noreply.user.github.com",
							url: "https://github.com/ghost",
							approvalStatus: "APPROVED"
						}
					],
					sourceBranch: "use-the-force",
					sourceBranchUrl:
						"https://github.com/integrations/test/tree/use-the-force",
					status: "MERGED",
					timestamp: updated_at,
					title: title,
					url: "https://github.com/integrations/test/pull/51",
					updateSequenceId: 12345678
				}
			],
			branches: [],
			url: "https://github.com/integrations/test",
			updateSequenceId: 12345678
		});
	});

	it("maps empty state to UNAPPROVED", async () => {
		const pullRequestList = Object.assign({},
			transformPullRequestList
		);

		const pulLRequestFixture = pullRequestList[0];
		pulLRequestFixture.title = "[TEST-1] Branch payload with loads of issue keys Test";

		const reviewrsListNoState = _.cloneDeep(reviewersListHasUser);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		delete reviewrsListNoState[0].state;

		const data = await transformPullRequest(client, pulLRequestFixture as any, reviewrsListNoState as any);

		const { updated_at, title } = pulLRequestFixture;

		expect(data).toStrictEqual({
			id: "100403908",
			name: "integrations/test",
			pullRequests: [
				{
					author: {
						avatar: "https://github.com/ghost.png",
						email: "deleted@noreply.user.github.com",
						name: "Deleted User",
						url: "https://github.com/ghost"
					},
					commentCount: 0,
					destinationBranch: "devel",
					destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
					displayId: "#51",
					id: 51,
					issueKeys: ["TEST-1"],
					lastUpdate: updated_at,
					reviewers: [
						{
							avatar: "https://github.com/images/error/octocat_happy.gif",
							name: "octocat",
							email: "octocat@noreply.user.github.com",
							url: "https://github.com/octocat",
							approvalStatus: "UNAPPROVED"
						}
					],
					sourceBranch: "use-the-force",
					sourceBranchUrl:
						"https://github.com/integrations/test/tree/use-the-force",
					status: "MERGED",
					timestamp: updated_at,
					title: title,
					url: "https://github.com/integrations/test/pull/51",
					updateSequenceId: 12345678
				}
			],
			branches: [],
			url: "https://github.com/integrations/test",
			updateSequenceId: 12345678
		});
	});

	it("should resolve reviewer's email", async () => {
		const pullRequestList = Object.assign({},
			transformPullRequestList
		);

		const fixture = pullRequestList[0];
		fixture.title = "[TEST-1] Branch payload with loads of issue keys Test";
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		fixture.user = null;

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/users/${reviewersListHasUser[0].user.login}`)
			.reply(200, {
				...reviewersListHasUser[0].user,
				email: "octocat-mapped@github.com"
			});

		const data = await transformPullRequest(client, fixture as any, reviewersListHasUser as any);

		const { updated_at, title } = fixture;

		expect(data).toMatchObject({
			id: "100403908",
			name: "integrations/test",
			pullRequests: [
				{
					author: {
						avatar: "https://github.com/ghost.png",
						name: "Deleted User",
						url: "https://github.com/ghost"
					},
					destinationBranch: "devel",
					destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
					displayId: "#51",
					id: 51,
					issueKeys: ["TEST-1"],
					lastUpdate: updated_at,
					reviewers: [
						{
							avatar: "https://github.com/images/error/octocat_happy.gif",
							email: "octocat-mapped@github.com",
							name: "octocat",
							url: "https://github.com/octocat",
							approvalStatus: "APPROVED"
						}
					],
					sourceBranch: "use-the-force",
					sourceBranchUrl:
						"https://github.com/integrations/test/tree/use-the-force",
					status: "MERGED",
					timestamp: updated_at,
					title: title,
					url: "https://github.com/integrations/test/pull/51",
					updateSequenceId: 12345678
				}
			],
			branches: [],
			url: "https://github.com/integrations/test",
			updateSequenceId: 12345678
		});
	});

	it("should send the correct review state for multiple reviewers", async () => {
		const pullRequestList = Object.assign({},
			transformPullRequestList
		);

		const fixture = pullRequestList[0];
		fixture.title = "[TEST-1] the PR where reviewers can't make up their minds";
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		fixture.user = null;

		githubUserTokenNock(gitHubInstallationId);

		const data = await transformPullRequest(client, fixture as any, multipleReviewersWithMultipleReviews as any);

		expect({ firstReviewStatus: data?.pullRequests[0].reviewers[0] }).toEqual(expect.objectContaining({
			firstReviewStatus: expect.objectContaining({
				approvalStatus: "UNAPPROVED"
			})
		}));

		expect({ secondReviewStatus: data?.pullRequests[0].reviewers[1] }).toEqual(expect.objectContaining({
			secondReviewStatus: expect.objectContaining({
				approvalStatus: "APPROVED"
			})
		}));
	});
});

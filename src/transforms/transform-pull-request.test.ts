/* eslint-disable @typescript-eslint/no-explicit-any */
import { transformPullRequest, transformPullRequestRest } from "./transform-pull-request";
import transformPullRequestList from "fixtures/api/transform-pull-request-list.json";
import reviewersListNoUser from "fixtures/api/pull-request-reviewers-no-user.json";
import reviewersListHasUser from "fixtures/api/pull-request-reviewers-has-user.json";
import multipleReviewersWithMultipleReviews
	from "fixtures/api/pull-request-has-multiple-reviewers-with-multiple-reviews.json";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { getInstallationId } from "~/src/github/client/installation-id";
import { getLogger } from "config/logger";
import { shouldSendAll } from "config/feature-flags";
import _, { cloneDeep } from "lodash";
import { createLogger } from "bunyan";
import { when } from "jest-when";

jest.mock("config/feature-flags");
describe("pull_request transform REST", () => {
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

		const data = await transformPullRequestRest(client, fixture as any, [], getLogger("test"), jiraHost);

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

		const data = await transformPullRequestRest(client, fixture as any, [], getLogger("test"), jiraHost);

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

		const data = await transformPullRequestRest(client, fixture as any, [], getLogger("test"), jiraHost);

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

		const data = await transformPullRequestRest(client, fixture as any, reviewersListNoUser as any, getLogger("test"), jiraHost);

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

		const data = await transformPullRequestRest(client, pulLRequestFixture as any, reviewrsListNoState as any, getLogger("test"), jiraHost);

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

	it("maps CHANGES_REQUESTED state to NEEDSWORK", async () => {
		const pullRequestList = Object.assign({},
			transformPullRequestList
		);

		const pulLRequestFixture = pullRequestList[0];
		pulLRequestFixture.title = "[TEST-1] Branch payload with loads of issue keys Test";

		const reviewersListChangesRequestedState = _.cloneDeep(reviewersListHasUser);
		reviewersListChangesRequestedState[0].state = "CHANGES_REQUESTED";

		const data = await transformPullRequestRest(client, pulLRequestFixture as any, reviewersListChangesRequestedState as any, getLogger("test"), jiraHost);

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
							approvalStatus: "NEEDSWORK"
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

		const data = await transformPullRequestRest(client, fixture as any, reviewersListHasUser as any, getLogger("test"), jiraHost);

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

	it("should map pullrequest without associations", async () => {
		when(shouldSendAll).calledWith("prs", expect.anything(), expect.anything()).mockResolvedValue(true);

		const fixture = cloneDeep(transformPullRequestList[0]);
		fixture.title = "PR without an issue key";
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		fixture.user = null;

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/users/${reviewersListHasUser[0].user.login}`)
			.reply(200, {
				...reviewersListHasUser[0].user,
				email: "octocat-mapped@github.com"
			});

		const data = await transformPullRequestRest(client, fixture as any, reviewersListHasUser as any, getLogger("test"), jiraHost);

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
					issueKeys: [],
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

		const data = await transformPullRequestRest(client, fixture as any, multipleReviewersWithMultipleReviews as any, getLogger("test"), jiraHost);

		expect({ firstReviewStatus: data?.pullRequests[0].reviewers[0] }).toEqual(expect.objectContaining({
			firstReviewStatus: expect.objectContaining({
				approvalStatus: "NEEDSWORK"
			})
		}));

		expect({ secondReviewStatus: data?.pullRequests[0].reviewers[1] }).toEqual(expect.objectContaining({
			secondReviewStatus: expect.objectContaining({
				approvalStatus: "APPROVED"
			})
		}));
	});

	it("should map to draft status when PR is 'open' is draft property is true", async () => {
		const pullRequestList = Object.assign({},
			transformPullRequestList
		);

		const fixture = pullRequestList[3];
		fixture.title = "[TESt-1] Draft PR Test";

		const data = await transformPullRequestRest(client, fixture as any, [], getLogger("test"), jiraHost);
		const { updated_at, title } = fixture;

		expect(data).toMatchObject({
			id: "100403908",
			name: "someusername/test",
			pullRequests: [
				{
					author: {
						avatar: "https://avatars0.githubusercontent.com/u/173?v=4",
						name: "Some User Name",
						url: "https://api.github.com/users/someusername"
					},
					destinationBranch: "devel",
					destinationBranchUrl: "https://github.com/someusername/test/tree/devel",
					displayId: "#51",
					id: 51,
					issueKeys: ["TEST-1"],
					lastUpdate: updated_at,
					sourceBranch: "use-the-force",
					sourceBranchUrl:
						"https://github.com/someusername/test/tree/use-the-force",
					status: "DRAFT",
					timestamp: updated_at,
					title: title,
					url: "https://github.com/someusername/test/pull/51",
					updateSequenceId: 12345678
				}
			],
			branches: [
				{
					id: "use-the-force",
					issueKeys: ["TEST-1"],
					lastCommit: {
						author: {
							avatar: "https://avatars3.githubusercontent.com/u/31044959?v=4",
							name: "Some User Name",
							url: "https://github.com/someusername"
						},
						authorTimestamp: "2018-05-04T14:06:56Z",
						displayId: "09ca66",
						fileCount: 0,
						hash: "09ca669e4b5ff78bfa6a9fee74c384812e1f96dd",
						id: "09ca669e4b5ff78bfa6a9fee74c384812e1f96dd",
						issueKeys: ["TEST-1"],
						message: "n/a",
						updateSequenceId: 12345678,
						url: "https://github.com/someusername/test/commit/09ca669e4b5ff78bfa6a9fee74c384812e1f96dd"
					},
					name: "use-the-force",
					updateSequenceId: 12345678,
					url: "https://github.com/someusername/test/tree/use-the-force"
				}
			],
			url: "https://github.com/someusername/test",
			updateSequenceId: 12345678
		});
	});
});

describe("pull_request transform GraphQL", () => {
	const logger = createLogger({ name: "test", foo: 123 });

	beforeEach(() => {
		mockSystemTime(12345678);
	});

	const createReview = (state = "APPROVED", email = "test-pull-request-reviewer-login@email.test") => {
		return {
			nodes: [
				{
					submittedAt: "0",
					state,
					author: {
						login: "test-pull-request-reviewer-login",
						avatarUrl: "test-pull-request-reviewer-avatar",
						email,
						url: "https://github.com/reviewer"
					}
				}
			]
		};
	};

	const createMultipleReviews = () => {
		return {
			nodes: [
				{
					submittedAt: "0",
					state: "UNAPPROVED",
					author: {
						login: "meanReviewer",
						avatarUrl: "test-pull-request-reviewer-avatar7",
						email: "meanReviewer@nice.com",
						url: "https://github.com/meanReviewer"
					}
				},
				{
					submittedAt: "2",
					state: "APPROVED",
					author: {
						login: "niceReviewer",
						avatarUrl: "test-pull-request-reviewer-avatar",
						email: "niceReviewer@nice.com",
						url: "https://github.com/niceReviewer"
					}
				}
			]
		};
	};

	const REPO_OBJ = {
		id: 12321,
		full_name: "myOrg/integrations",
		html_url: "https://github.com/myOrg/integrations",
		updated_at: new Date().toString(),
		name: "test",
		owner: {
			login: "integrations"
		}
	};

	const createPullPayload = (title = "fake title", state = "MERGED") => {
		return {
			state,
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
			baseRefName: "devel",
			headRefName: "evernote-test",
			headRef: {
				name: "evernote-test",
				repository: {
					name: "test",
					owner: {
						login: "integrations"
					}
				}
			},
			body: "",
			reviews: createReview()
		};
	};

	it("should transform deleted author and reviewers and headRef without exploding", async () => {
		const title = "[TES-123] Branch payload Test";
		const payload = _.cloneDeep(createPullPayload(title));
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		payload.reviews.nodes[0].author = {};

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		delete payload.headRef;

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		delete payload.author;

		const { updatedAt } = payload;

		const data = transformPullRequest(REPO_OBJ, jiraHost, payload as any, true, logger);

		expect(data).toMatchObject({
			author: {
				avatar: "https://github.com/ghost.png",
				name: "Deleted User",
				email: "deleted@noreply.user.github.com",
				url: "https://github.com/ghost"
			},
			destinationBranch: "devel",
			destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
			displayId: "#51",
			id: 51,
			issueKeys: ["TES-123"],
			lastUpdate: updatedAt,
			reviewers: [
				{
					avatar: "https://github.com/ghost.png",
					name: "Deleted User",
					email: "deleted@noreply.user.github.com",
					url: "https://github.com/ghost",
					approvalStatus: "APPROVED"
				}
			],
			sourceBranch: "evernote-test",
			status: "MERGED",
			timestamp: updatedAt,
			title,
			url: "https://github.com/integrations/test/pull/51",
			updateSequenceId: 12345678
		});
	});

	it("maps empty state to UNAPPROVED", async () => {
		const title = "[TES-123] Branch payload Test";
		const payload = { ...createPullPayload(title) };
		payload.reviews = createReview("");

		const { updatedAt } = payload;

		const data = transformPullRequest(REPO_OBJ, jiraHost, payload as any, true, logger);

		expect(data).toStrictEqual({
			author: {
				avatar: "test-pull-request-author-avatar",
				email: "test-pull-request-author-login@noreply.user.github.com",
				name: "test-pull-request-author-login",
				url: "test-pull-request-author-url"
			},
			commentCount: 10,
			destinationBranch: "devel",
			destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
			displayId: "#51",
			id: 51,
			issueKeys: ["TES-123"],
			lastUpdate: updatedAt,
			reviewers: [
				{
					avatar: "test-pull-request-reviewer-avatar",
					email: "test-pull-request-reviewer-login@email.test",
					name: "test-pull-request-reviewer-login",
					url: "https://github.com/reviewer",
					approvalStatus: "UNAPPROVED"
				}
			],
			sourceBranch: "evernote-test",
			sourceBranchUrl: "https://github.com/integrations/test/tree/evernote-test",
			status: "MERGED",
			timestamp: updatedAt,
			title,
			url: "https://github.com/integrations/test/pull/51",
			updateSequenceId: 12345678
		});
	});

	it("maps CHANGES_REQUESTED state to NEEDSWORK", async () => {
		const title = "[TES-123] Branch payload Test";
		const payload = { ...createPullPayload(title) };
		payload.reviews = createReview("CHANGES_REQUESTED");

		const { updatedAt } = payload;

		const data = await transformPullRequest(REPO_OBJ, jiraHost, payload as any, true, logger);

		expect(data).toStrictEqual({
			author: {
				avatar: "test-pull-request-author-avatar",
				email: "test-pull-request-author-login@noreply.user.github.com",
				name: "test-pull-request-author-login",
				url: "test-pull-request-author-url"
			},
			commentCount: 10,
			destinationBranch: "devel",
			destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
			displayId: "#51",
			id: 51,
			issueKeys: ["TES-123"],
			lastUpdate: updatedAt,
			reviewers: [
				{
					avatar: "test-pull-request-reviewer-avatar",
					email: "test-pull-request-reviewer-login@email.test",
					name: "test-pull-request-reviewer-login",
					url: "https://github.com/reviewer",
					approvalStatus: "NEEDSWORK"
				}
			],
			sourceBranch: "evernote-test",
			sourceBranchUrl: "https://github.com/integrations/test/tree/evernote-test",
			status: "MERGED",
			timestamp: updatedAt,
			title,
			url: "https://github.com/integrations/test/pull/51",
			updateSequenceId: 12345678
		});
	});

	it("should resolve reviewer's email", async () => {
		const title = "[TES-123] Branch payload Test";
		const payload = { ...createPullPayload(title), author: {} };
		payload.reviews = createReview("APPROVED", "cool-email@emails.com");

		const data = await transformPullRequest(REPO_OBJ, jiraHost, payload as any, true, logger);
		const { updatedAt } = payload;

		expect(data).toMatchObject({
			author: {
				avatar: "https://github.com/ghost.png",
				name: "Deleted User",
				url: "https://github.com/ghost"
			},
			destinationBranch: "devel",
			destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
			displayId: "#51",
			id: 51,
			issueKeys: ["TES-123"],
			lastUpdate: updatedAt,
			reviewers: [
				{
					avatar: "test-pull-request-reviewer-avatar",
					email: "cool-email@emails.com",
					name: "test-pull-request-reviewer-login",
					url: "https://github.com/reviewer",
					approvalStatus: "APPROVED"
				}
			],
			sourceBranch: "evernote-test",
			sourceBranchUrl: "https://github.com/integrations/test/tree/evernote-test",
			status: "MERGED",
			timestamp: updatedAt,
			title,
			url: "https://github.com/integrations/test/pull/51",
			updateSequenceId: 12345678
		});
	});

	it("should send the correct review state for multiple reviewers", async () => {
		const title = "[TES-123] Branch payload Test";
		const payload = { ...createPullPayload(title), author: {} };
		payload.reviews = createMultipleReviews();

		const data = await transformPullRequest(REPO_OBJ, jiraHost, payload as any, true, logger);

		expect({ firstReviewStatus: data?.reviewers[0] }).toEqual(expect.objectContaining({
			firstReviewStatus: expect.objectContaining({
				approvalStatus: "UNAPPROVED"
			})
		}));

		expect({ secondReviewStatus: data?.reviewers[1] }).toEqual(expect.objectContaining({
			secondReviewStatus: expect.objectContaining({
				approvalStatus: "APPROVED"
			})
		}));
	});
});

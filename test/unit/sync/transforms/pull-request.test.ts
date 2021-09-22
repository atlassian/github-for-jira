/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import transformPullRequest from "../../../../src/sync/transforms/pull-request";
import { PullRequest } from "../../../../src/services/github/pull-requests";

describe("pull_request transform", () => {
	let fixture: PullRequest;

	beforeEach(() => {

		fixture = {
			id: "fsdsnu329",
			number: 51,
			url: "https://github.com/test-owner/test-repo/pull/51",
			merged: false,
			state: "CLOSED",
			title: "[TES-123] Evernote Test",
			body: "Some test body",
			createdAt: "2021-09-22T00:43:09+00:00",
			updatedAt: "2021-09-22T00:43:09+00:00",
			comments: {
				totalCount: 10
			},
			author: {
				login: "test-owner",
				url: "https://github.com/test-owner",
				name: "Test Owner",
				email: "test-owner@test.com",
				avatarUrl: "https://github.com/test-owner.png"
			},
			repository: {
				id: "msdu3243",
				name: "test-owner/test-repo",
				url: "https://github.com/test-owner/test-repo"
			},
			headRef: {
				name: "use-the-force"
			},
			baseRef: {
				name: "devel"
			}
		};
	});

	it("should send the ghost user to Jira when GitHub user has been deleted", async () => {
		Date.now = jest.fn(() => 12345678);
		fixture.author = undefined;
		const data = transformPullRequest(fixture);
		expect(data).toMatchObject({
			// 'ghost' is a special user GitHub associates with
			// comments/PRs when a user deletes their account
			author: {
				avatar: "https://github.com/ghost.png",
				name: "Deleted User",
				url: "https://github.com/ghost"
			},
			commentCount: 10,
			destinationBranch:
						"https://github.com/test-owner/test-repo/tree/devel",
			displayId: "#51",
			id: "51",
			issueKeys: ["TES-123"],
			lastUpdate: fixture.updatedAt,
			sourceBranch: "use-the-force",
			sourceBranchUrl:
						"https://github.com/test-owner/test-repo/tree/use-the-force",
			status: "DECLINED",
			timestamp: fixture.updatedAt,
			title: fixture.title,
			url: "https://github.com/test-owner/test-repo/pull/51",
			updateSequenceId: 12345678
		});
	});

	it("should return no data if there are no issue keys", async () => {
		fixture.title = "No Issue Keys";
		Date.now = jest.fn(() => 12345678);

		expect(transformPullRequest(
			fixture,
		)).toBeUndefined();
	});
});

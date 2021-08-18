/* eslint-disable @typescript-eslint/no-var-requires */
import { createWebhookApp } from "../../../../test-utils/probot";

describe("GitHub Actions", () => {
	let app;
	beforeEach(async () => app = await createWebhookApp());

	describe("Create Branch", () => {
		it("should update Jira issue with link to a branch on GitHub", async () => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const fixture = require("../../../common/test-utils/fixtures/branch-basic.json");


			const ref = "TES-123-test-ref";
			const sha = "test-branch-ref-sha";

			githubNock.get(`/repos/test-repo-owner/test-repo-name/git/refs/heads/${ref}`)
				.reply(200, {
					ref: "refs/heads/test-ref",
					object: {
						sha
					}
				});
			githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/${sha}`)
				.reply(200, {
					commit: {
						author: {
							name: "test-branch-author-name",
							date: "test-branch-author-date"
						},
						message: "test-commit-message"
					},
					html_url: `test-repo-url/commits/${sha}`
				});


			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
				repositories: [
					{
						name: "example/test-repo-name",
						url: "test-repo-url",
						id: "test-repo-id",
						branches: [
							{
								createPullRequestUrl: "test-repo-url/pull/new/TES-123-test-ref",
								lastCommit: {
									author: { name: "test-branch-author-name" },
									authorTimestamp: "test-branch-author-date",
									displayId: "test-b",
									fileCount: 0,
									hash: "test-branch-ref-sha",
									id: "test-branch-ref-sha",
									issueKeys: ["TES-123"],
									message: "test-commit-message",
									updateSequenceId: 12345678,
									url: "test-repo-url/commits/test-branch-ref-sha"
								},
								id: "TES-123-test-ref",
								issueKeys: ["TES-123"],
								name: "TES-123-test-ref",
								url: "test-repo-url/tree/TES-123-test-ref",
								updateSequenceId: 12345678
							}
						],
						updateSequenceId: 12345678
					}
				],
				properties: {
					installationId: 1234
				}
			}).reply(200);

			Date.now = jest.fn(() => 12345678);

			await expect(app.receive(fixture)).toResolve();
		});

		it("should not update Jira issue if there are no issue Keys in the branch name", async () => {
			const fixture = require("../../../common/test-utils/fixtures/branch-no-issues.json");
			const getLastCommit = jest.fn();

			await expect(app.receive(fixture)).toResolve();
			expect(getLastCommit).not.toBeCalled();
		});

		it("should exit early if ref_type is not a branch", async () => {
			const fixture = require("../../../common/test-utils/fixtures/branch-invalid-ref_type.json");
			const parseSmartCommit = jest.fn();

			await expect(app.receive(fixture)).toResolve();
			expect(parseSmartCommit).not.toBeCalled();
		});
	});

	describe("delete a branch", () => {
		it("should call the devinfo delete API when a branch is deleted", async () => {
			const fixture = require("../../../common/test-utils/fixtures/branch-delete.json");
			jiraNock
				.delete("/rest/devinfo/0.10/repository/test-repo-id/branch/TES-123-test-ref?_updateSequenceId=12345678")
				.reply(200);

			Date.now = jest.fn(() => 12345678);
			await expect(app.receive(fixture)).toResolve();
		});
	});
});

/* eslint-disable @typescript-eslint/no-var-requires */
import { createWebhookApp } from "../utils/probot";
import nock from "nock";
import { Installation, Subscription } from "../../src/models";
import { mocked } from "ts-jest/utils";

jest.mock("../../src/models");

describe("GitHub Actions", () => {
	let app;
	beforeEach(async () => {
		mocked(Subscription.getAllForInstallation).mockResolvedValue([
			{
				jiraHost: process.env.ATLASSIAN_URL,
				gitHubInstallationId: 1234,
				enabled: true
			}] as any);
		mocked(Subscription.getSingleInstallation).mockResolvedValue(
			{
				id: 1,
				jiraHost: process.env.ATLASSIAN_URL
			} as any);
		mocked(Installation.getForHost).mockResolvedValue(
			{
				jiraHost: process.env.ATLASSIAN_URL,
				sharedSecret: process.env.ATLASSIAN_SECRET,
				enabled: true
			} as any
		);
		app = await createWebhookApp()
	});

	afterEach(async () => {
		if (!nock.isDone()) {
			// eslint-disable-next-line jest/no-standalone-expect
			expect(nock).toBeDone();
		}
		nock.cleanAll();
	});

	describe("Create Branch", () => {
		it("should update Jira issue with link to a branch on GitHub", async () => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const fixture = require("../fixtures/branch-basic.json");

			const sha = "test-branch-ref-sha";
			//Issue with Octokit where it doenst encode the uri
			githubNock.get("/repos/test-repo-owner/test-repo-name/git/ref/heads%2FTES-123-test-ref")
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
						id: "test-repo-id",
						name: "example/test-repo-name",
						url: "test-repo-url",
						branches: [
							{
								createPullRequestUrl: "test-repo-url/pull/new/TES-123-test-ref",
								lastCommit: {
									author: {
										avatar: "https://github.com/users/undefined.png",
										name: "test-branch-author-name",
										email: "undefined@noreply.user.github.com",
										url: "https://github.com/users/undefined"
									},
									authorTimestamp: "test-branch-author-date",
									displayId: "test-b",
									fileCount: 0,
									hash: "test-branch-ref-sha",
									id: "test-branch-ref-sha",
									issueKeys: ["TES-123"],
									message: "test-commit-message",
									url: "test-repo-url/commits/test-branch-ref-sha",
									updateSequenceId: 12345678
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
				properties: { installationId: 1234 }
			}).reply(200);

			Date.now = jest.fn(() => 12345678);

			await expect(app.receive(fixture)).toResolve();
		});

		it("should not update Jira issue if there are no issue Keys in the branch name", async () => {
			const fixture = require("../fixtures/branch-no-issues.json");
			const getLastCommit = jest.fn();

			await expect(app.receive(fixture)).toResolve();
			expect(getLastCommit).not.toBeCalled();
		});

		it("should exit early if ref_type is not a branch", async () => {
			const fixture = require("../fixtures/branch-invalid-ref_type.json");
			const parseSmartCommit = jest.fn();

			await expect(app.receive(fixture)).toResolve();
			expect(parseSmartCommit).not.toBeCalled();
		});
	});

	describe("delete a branch", () => {
		it("should call the devinfo delete API when a branch is deleted", async () => {
			const fixture = require("../fixtures/branch-delete.json");
			jiraNock
				.delete("/rest/devinfo/0.10/repository/test-repo-id/branch/TES-123-test-ref?_updateSequenceId=12345678")
				.reply(200);

			Date.now = jest.fn(() => 12345678);
			await expect(app.receive(fixture)).toResolve();
		});
	});
});

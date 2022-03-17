/* eslint-disable @typescript-eslint/no-explicit-any */
import { createWebhookApp } from "test/utils/probot";
import { Application } from "probot";
import { Installation, Subscription } from "../models";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

import issueCommentBasic from "fixtures/issue-comment-basic.json";

jest.mock("config/feature-flags");

describe.each([true, false])("Issue Comment Webhook - FF %p", (useNewGithubClient) => {
	let app: Application;
	const gitHubInstallationId = 1234;

	beforeEach(async () => {
		app = await createWebhookApp();

		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});

		await Installation.create({
			jiraHost,
			clientKey: "client-key",
			sharedSecret: "shared-secret"
		});

		when(booleanFlag).calledWith(
			BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_ISSUE_COMMENT_WEBHOOK,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(useNewGithubClient);
	});

	describe("issue_comment", () => {
		describe("created", () => {
			it("should update the GitHub issue with a linked Jira ticket", async () => {
				if(useNewGithubClient) {
					githubUserTokenNock(gitHubInstallationId);
				}

				jiraNock
					.get("/rest/api/latest/issue/TEST-123?fields=summary")
					.reply(200, {
						key: "TEST-123",
						fields: {
							summary: "Example Issue"
						}
					});

				githubNock
					.patch("/repos/test-repo-owner/test-repo-name/issues/comments/5678", {
						body: `Test example comment with linked Jira issue: [TEST-123]\n\n[TEST-123]: ${jiraHost}/browse/TEST-123`
					})
					.reply(200);

				await expect(app.receive(issueCommentBasic as any)).toResolve();
			});
		});
	});
});

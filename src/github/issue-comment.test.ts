/* eslint-disable @typescript-eslint/no-explicit-any */
import { createWebhookApp } from "test/utils/probot";
import { Application } from "probot";
import { Installation, Subscription } from "models/index";

import issueCommentBasic from "fixtures/issue-comment-basic.json";

jest.mock("config/feature-flags");

describe("Issue Comment Webhook", () => {
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
	});

	describe("issue_comment", () => {
		describe("created", () => {
			it("should update the GitHub issue with a linked Jira ticket", async () => {
				githubUserTokenNock(gitHubInstallationId);

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

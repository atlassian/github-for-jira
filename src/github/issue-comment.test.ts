/* eslint-disable @typescript-eslint/no-explicit-any */
import { createWebhookApp } from "test/utils/probot";
import { Application } from "probot";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";

import issueCommentBasic from "fixtures/issue-comment-basic.json";

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
			encryptedSharedSecret: "shared-secret"
		});
	});

	describe("issue_comment", () => {
		describe("created", () => {
			it("should update the GitHub issue with a linked Jira ticket", async () => {
				githubUserTokenNock(gitHubInstallationId);

				// Mocks for updating Jira with GitHub comment
				githubNock
					.get("/repos/test-repo-owner/test-repo-name/pulls/TEST-123")
					.reply(200, {
						title: "pull-request-title",
						head: {
							ref: "TEST-123-branch-name"
						}
					});

				jiraNock
					.post("/rest/api/latest/issue/TEST-123/comment", {
						body: "Test example comment with linked Jira issue: [TEST-123] - some-comment-url",
						properties: [
							{
								key: "gitHubId",
								value: {
									gitHubId: "5678"
								}
							}
						]
					})
					.reply(201);

				// Mocks for updating GitHub with a linked Jira ticket
				jiraNock
					.get("/rest/api/latest/issue/TEST-123?fields=summary")
					.reply(200, {
						key: "TEST-123",
						fields: {
							summary: "Example Issue"
						}
					});

				// githubNock
				// 	.patch("/repos/test-repo-owner/test-repo-name/issues/comments/5678", {
				// 		body: `Test example comment with linked Jira issue: [TEST-123]\n\n[TEST-123]: ${jiraHost}/browse/TEST-123`
				// 	})
				// 	.reply(200);

				await expect(app.receive(issueCommentBasic as any)).toResolve();
			});
		});
	});
});

/* eslint-disable @typescript-eslint/no-var-requires */
import { createWebhookApp } from "../utils/probot";
import { Application } from "probot";
import { Installation, Subscription } from "../../src/models";

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

	afterEach(async () => {
		await Installation.destroy({ truncate: true });
		await Subscription.destroy({ truncate: true });
	});

	describe("issue_comment", () => {
		describe("created", () => {
			it("should update the GitHub issue with a linked Jira ticket", async () => {
				const fixture = require("../fixtures/issue-comment-basic.json");

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
						number: "test-issue-number",
						body: "Test example comment with linked Jira issue: [TEST-123]\n\n[TEST-123]: https://test-atlassian-instance.net/browse/TEST-123"
					})
					.reply(200);

				await expect(app.receive(fixture)).toResolve();
			});
		});
	});
});

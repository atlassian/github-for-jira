/* eslint-disable @typescript-eslint/no-var-requires */
import { createWebhookApp } from "../../../../test-utils/probot";

describe("GitHub Actions", () => {
	let app;
	beforeEach(async () => (app = await createWebhookApp()));

	describe("issue_comment", () => {
		describe("created", () => {
			it("should update the GitHub issue with a linked Jira ticket", async () => {
				const fixture = require("../../../common/test-utils/fixtures/issue-comment-basic.json");

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

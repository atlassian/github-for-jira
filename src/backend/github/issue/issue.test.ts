/* eslint-disable @typescript-eslint/no-var-requires */
import { createWebhookApp } from "../../../../test-utils/probot";

describe("GitHub Actions", () => {
	let app;
	beforeEach(async () => (app = await createWebhookApp()));

	describe("issue", () => {
		describe("created", () => {
			it("should update the GitHub issue with a linked Jira ticket", async () => {
				const fixture = require("../../../../test-utils/fixtures/issue-basic.json");

				jiraNock
					.get("/rest/api/latest/issue/TEST-123?fields=summary")
					.reply(200);

				githubNock
					.patch("/repos/test-repo-owner/test-repo-name/issues/123456789", {
						body: "Test example issue with linked Jira issue: [TEST-123]\n\n[TEST-123]: https://test-atlassian-instance.net/browse/TEST-123",
						id: "test-issue-id"
					})
					.reply(200, {
						key: "TEST-123",
						fields: {
							summary: "Example Issue"
						}
					});

				await expect(app.receive(fixture)).toResolve();
			});

			it("should not break if the issue has a null body", async () => {
				const fixture = require("../../../../test-utils/fixtures/issue-null-body.json");
				// should not throw
				await expect(app.receive(fixture)).toResolve();
			});
		});
	});
});


import { createWebhookApp } from "test/utils/probot";
import { Installation, Subscription } from "../models";
import { Application } from "probot";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

jest.mock("../config/feature-flags");

describe.each([true, false])("Issue Webhook - FF %p", (useNewGithubClient) => {
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
			BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_ISSUE_WEBHOOK,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(useNewGithubClient);
	});

	describe("issue", () => {
		describe("created", () => {
			it("should update the GitHub issue with a linked Jira ticket", async () => {
				const fixture = require("../../test/fixtures/issue-basic.json");

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
					.patch("/repos/test-repo-owner/test-repo-name/issues/123456789", {
						body: `Test example issue with linked Jira issue: [TEST-123]\n\n[TEST-123]: ${jiraHost}/browse/TEST-123`,
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
				const fixture = require("../../test/fixtures/issue-null-body.json");
				// should not throw
				await expect(app.receive(fixture)).toResolve();
			});
		});
	});
});

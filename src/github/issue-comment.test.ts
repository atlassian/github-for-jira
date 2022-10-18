/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import issueCommentBasic from "fixtures/issue-comment-basic.json";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { when } from "jest-when";

jest.mock("config/feature-flags");

const turnFF_OnOff = (newStatus: boolean) => {
	when(jest.mocked(booleanFlag))
		.calledWith(BooleanFlags.SEND_PR_COMMENTS_TO_JIRA, expect.anything(), expect.anything())
		.mockResolvedValue(newStatus);
};

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
			it("FF ON - should update the GitHub issue with a linked Jira ticket and add PR comment as comment in Jira issue", async () => {
				turnFF_OnOff(true);
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

				await expect(app.receive(issueCommentBasic as any)).toResolve();
			});

			it("FF OFF - should update the GitHub issue with a linked Jira ticket", async () => {
				githubUserTokenNock(gitHubInstallationId);

				// Mocks for updating GitHub with a linked Jira ticket
				jiraNock
					.get("/rest/api/latest/issue/TEST-123?fields=summary")
					.reply(200, {
						key: "TEST-123",
						fields: {
							summary: "Example Issue"
						}
					});

				await expect(app.receive(issueCommentBasic as any)).toResolve();
			});
		});
	});
});

import { jiraMatchingIssuesKeysBulkResponse, githubRequestUserLoginResponse, githubPullReviewsResponse, jiraMultipleJiraBulkResponse } from './nock-response';
/* eslint-disable @typescript-eslint/no-var-requires */
import { createWebhookApp } from "../utils/probot";
import { Application } from "probot";
import { Installation, Subscription } from "../../src/models";
import nock from "nock";

describe("multiple Jira instances", () => {
	let app: Application;
	const gitHubInstallationId = 1234;
	const jira2Host = "https://test2-atlassian-instance.net";
	const jira2Nock = nock(jira2Host);
	beforeEach(async () => {
		app = await createWebhookApp();
		const clientKey = "client-key";
		await Installation.create({
			clientKey,
			sharedSecret: "shared-secret",
			jiraHost
		});
		await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: clientKey
		});
		await Installation.create({
			clientKey,
			sharedSecret: "shared-secret",
			jiraHost: jira2Host,
		});
		await Subscription.create({
			gitHubInstallationId,
			jiraHost: jira2Host,
			jiraClientKey: clientKey
		});
	});

	afterEach(async () => {
		await Subscription.destroy({ truncate: true });
		await Subscription.destroy({ truncate: true });
	});

	it("should not linkify issue keys for jira instance that has matching issues", async () => {
		const fixture = require("../fixtures/pull-request-multiple-invalid-issue-key.json");
		githubNock.get("/users/test-pull-request-user-login")
			.times(2)
			.reply(200, githubRequestUserLoginResponse);

		githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/reviews")
			.times(2)
			.reply(200, githubPullReviewsResponse);

		githubNock.patch("/repos/test-repo-owner/test-repo-name/issues/1", {
			body: "[TEST-123] [TEST-222] body of the test pull request.\n\n[TEST-222]: https://test2-atlassian-instance.net/browse/TEST-222",
			id: "test-pull-request-id"
		}).reply(200);

		jiraNock
			.get("/rest/api/latest/issue/TEST-123?fields=summary")
			.reply(401);

		jiraNock
			.get("/rest/api/latest/issue/TEST-222?fields=summary")
			.reply(401);

		jira2Nock
			.get("/rest/api/latest/issue/TEST-123?fields=summary")
			.reply(401);

		jira2Nock
			.get("/rest/api/latest/issue/TEST-222?fields=summary")
			.reply(200, {
				key: "TEST-222",
				fields: {
					summary: "Example Issue"
				}
			});

		jiraNock.post("/rest/devinfo/0.10/bulk", jiraMatchingIssuesKeysBulkResponse).reply(200);
		jira2Nock.post("/rest/devinfo/0.10/bulk", jiraMatchingIssuesKeysBulkResponse).reply(200);
		Date.now = jest.fn(() => 12345678);

		await expect(app.receive(fixture)).toResolve();
	});

	it("should associate PR with to multiple jira with same issue keys", async () => {
		const fixture = require("../fixtures/pull-request-basic.json");

		githubNock.get("/users/test-pull-request-user-login")
			.twice()
			.reply(200, githubRequestUserLoginResponse);

		githubNock.get("/repos/test-repo-owner/test-repo-name/pulls/1/reviews")
			.twice()
			.reply(200, githubPullReviewsResponse);

		githubNock.patch("/repos/test-repo-owner/test-repo-name/issues/1", {
			body: "[TEST-123] body of the test pull request.\n\n[TEST-123]: https://test-atlassian-instance.net/browse/TEST-123",
			id: "test-pull-request-id"
		}).reply(200);

		githubNock
			.patch("/repos/test-repo-owner/test-repo-name/issues/1", {
				body: "[TEST-123] body of the test pull request.\n\n[TEST-123]: https://test2-atlassian-instance.net/browse/TEST-123",
				id: "test-pull-request-id"
			}).reply(200)

		jiraNock
			.get("/rest/api/latest/issue/TEST-123?fields=summary")
			.reply(200, {
				key: "TEST-123",
				fields: {
					summary: "Example Issue"
				}
			});
		jira2Nock
			.get("/rest/api/latest/issue/TEST-123?fields=summary")
			.reply(200, {
				key: "TEST-123",
				fields: {
					summary: "Example Issue"
				}
			});

		jiraNock.post("/rest/devinfo/0.10/bulk", jiraMultipleJiraBulkResponse).reply(200)
		jira2Nock.post("/rest/devinfo/0.10/bulk", jiraMultipleJiraBulkResponse).reply(200);

		Date.now = jest.fn(() => 12345678);

		await expect(app.receive(fixture)).toResolve();
	});
});
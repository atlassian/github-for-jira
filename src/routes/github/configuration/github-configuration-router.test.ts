/* eslint-disable jest/expect-expect */
import supertest from "supertest";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { getFrontendApp } from "~/src/app";
import { getLogger } from "config/logger";
import express, { Application } from "express";
import { getSignedCookieHeader } from "test/utils/cookies";
import { ViewerRepositoryCountQuery } from "~/src/github/client/github-queries";
import installationResponse from "fixtures/jira-configuration/single-installation.json";
import { getJiraClient } from "~/src/jira/client/jira-client";

jest.mock("config/feature-flags");

describe("Github Configuration", () => {
	let frontendApp: Application;
	let sub: Subscription;
	let client: any;

	const authenticatedUserResponse = { login: "test-user" };
	const adminUserResponse = { login: "admin-user" };
	const organizationMembershipResponse = { role: "member" };
	const organizationAdminResponse = { role: "admin" };
	beforeEach(async () => {
		sub = await Subscription.create({
			gitHubInstallationId: 15,
			jiraHost,
			jiraClientKey: "myClientKey"
		});

		await Installation.create({
			jiraHost,
			clientKey: "abc123",
			//TODO: why? Comment this out make test works?
			//setting both fields make sequelize confused as it internally storage is just the "secrets"
			//secrets: "def234",
			encryptedSharedSecret: "ghi345"
		});

		frontendApp = express();
		frontendApp.use((request, _, next) => {
			request.log = getLogger("test");
			next();
		});
		frontendApp.use(getFrontendApp());

		client = await getJiraClient(jiraHost, 15, undefined, undefined);
	});

	describe("Github Token Validation", () => {
		it("should return redirect to github oauth flow for GET request if token is missing", async () =>
			supertest(frontendApp)
				.get("/github/configuration")
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost
					})
				)
				.expect(res => {
					expect(res.status).toBe(302);
					expect(res.headers.location).toContain("github.com/login/oauth/authorize");
				}));

		it("should return redirect to github oauth flow for GET request if token is invalid", async () => {
			githubNock
				.get("/")
				.matchHeader("Authorization", /^Bearer .+$/)
				.reply(403);

			return supertest(frontendApp)
				.get("/github/configuration")
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
						githubToken: "token"
					})
				)
				.expect(res => {
					expect(res.status).toBe(302);
					expect(res.headers.location).toContain("github.com/login/oauth/authorize");
				});
		});

		it("should return 401 if doing a POST request with a missing github token", async () =>
			supertest(frontendApp)
				.post("/github/configuration")
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost
					})
				)
				.expect(401));

		it("should return 401 if doing a POST request with an invalid github token", async () => {
			githubNock
				.get("/")
				.matchHeader("Authorization", /^Bearer .+$/)
				.reply(403);

			await supertest(frontendApp)
				.post("/github/configuration")
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
						githubToken: "token"
					})
				)
				.expect(401);
		});
	});

	describe("#GET - GithubClient - %s", () => {
		it("should return 200 when calling with valid Github Token", async () => {
			githubNock
				.get("/")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);

			githubNock
				.get("/user")
				.reply(200, { login: "test-user" });

			githubUserTokenNock(sub.gitHubInstallationId);

			githubNock
				.get(`/app/installations/${sub.gitHubInstallationId}`)
				.reply(200, {
					"id": 1,
					"account": {
						"login": "octocat",
						"id": 1,
						"type": "User"
					},
					"html_url": "https://github.com/organizations/github/settings/installations/1",
					"target_type": "Organization",
					"created_at": "2017-07-08T16:18:44-04:00",
					"updated_at": "2017-07-08T16:18:44-04:00"
				});

			githubNock
				.get(`/user/installations`)
				.reply(200, {
					installations: [{
						id: sub.gitHubInstallationId,
						account: {
							login: "test-org"
						},
						target_type: "Organization"
					}]
				});

			githubNock
				.get(`/user/memberships/orgs/test-org`)
				.reply(200, {
					role: "admin"
				});

			githubNock
				.get(`/app`)
				.reply(200, {
					html_url: "https://github.com/apps/jira"
				});

			githubNock
				.post("/graphql", { query: ViewerRepositoryCountQuery })
				.query(true)
				.reply(200, {
					data: {
						viewer: {
							repositories: {
								totalCount: 1
							}
						}
					}
				});

			jiraNock
				.put("/rest/atlassian-connect/latest/addons/com.github.integration.test-atlassian-instance/properties/is-configured", { "isConfigured": "false" })
				.reply(200, "OK");

			await client.appProperties.create("false");

			await supertest(frontendApp)
				.get("/github/configuration")
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
						githubToken: "token"
					})
				)
				.expect(200);
		});

		it("should return 200 even when organization is IP blocked", async () => {
			githubNock
				.get("/")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);

			githubNock
				.get("/user")
				.reply(200, { login: "test-user" });

			githubUserTokenNock(sub.gitHubInstallationId);

			githubNock
				.get(`/app/installations/${sub.gitHubInstallationId}`)
				.reply(403, {
					message: "Although you appear to have the correct authorization credentials, the `Fusion-Arc` organization has an IP allow list enabled, and 13.52.4.51 is not permitted to access this resource."
				});

			githubNock
				.get("/user/installations")
				.reply(200, {
					installations: [{
						id: sub.gitHubInstallationId,
						account: {
							login: "test-org"
						},
						target_type: "Organization"
					}]
				});

			githubNock
				.get("/user/memberships/orgs/test-org")
				.reply(200, {
					role: "admin"
				});

			githubNock
				.get("/app")
				.reply(200, {
					html_url: "https://github.com/apps/jira"
				});

			githubNock
				.post("/graphql", { query: ViewerRepositoryCountQuery })
				.query(true)
				.reply(403, {
					message: "Although you appear to have the correct authorization credentials, the `Fusion-Arc` organization has an IP allow list enabled, and 13.52.4.51 is not permitted to access this resource."
				});

			await supertest(frontendApp)
				.get("/github/configuration")
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
						githubToken: "token2"
					})
				)
				.expect(200);
		});
	});

	describe("#POST - GitHub Client is %s", () => {
		it("should return a 401 if no GitHub token present in session", async () => {
			await supertest(frontendApp)
				.post("/github/configuration")
				.send({})
				.set(
					"Cookie",
					getSignedCookieHeader({ jiraHost })
				)
				.expect(401);
		});

		it("should return a 401 if no Jira host present in session", async () => {

			await supertest(frontendApp)
				.post("/github/configuration")
				.send({})
				.set(
					"Cookie",
					getSignedCookieHeader({
						githubToken: "test-github-token"
					})
				)
				.expect(401);
		});

		it("should return a 401 if the user doesn't have access to the requested installation ID", async () => {
			// This is for github token validation check
			githubNock
				.get("/")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);

			githubNock
				.get("/user")
				.reply(200, { login: "test-user" });

			githubNock
				.get("/app/installations/2")
				.reply(404);

			await supertest(frontendApp)
				.post("/github/configuration")
				.send({
					installationId: 2,
					clientKey: sub.jiraClientKey
				})
				.type("form")
				.set(
					"Cookie",
					getSignedCookieHeader({
						githubToken: "test-github-token",
						jiraHost
					})
				)
				.expect(401);
		});

		it("should return a 401 if the user is not an admin of the Org", async () => {
			// This is for github token validation check
			githubNock
				.get("/")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);

			githubNock
				.get("/user")
				.reply(200, authenticatedUserResponse);

			githubNock
				.get("/app/installations/1")
				.reply(200, installationResponse);

			githubNock
				.get("/user/memberships/orgs/fake-account")
				.reply(200, organizationMembershipResponse);

			await supertest(frontendApp)
				.post("/github/configuration")
				.send({
					installationId: 1,
					clientKey: sub.jiraClientKey
				})
				.type("form")
				.set(
					"Cookie",
					getSignedCookieHeader({
						githubToken: "test-github-token",
						jiraHost
					})
				)
				.expect(401);
		});

		it("should return a 400 if no installationId is present in the body", async () => {
			// This is for github token validation check
			githubNock
				.get("/")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);
			await supertest(frontendApp)
				.post("/github/configuration")
				.send({})
				.set(
					"Cookie",
					getSignedCookieHeader({
						githubToken: "test-github-token",
						jiraHost
					})
				)
				.expect(400);
		});

		it("should return a 200 and install a Subscription", async () => {

			// This is for github token validation check
			githubNock
				.get("/")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);

			githubNock
				.get("/user")
				.reply(200, adminUserResponse);

			githubNock
				.get("/app/installations/1")
				.reply(200, installationResponse);

			githubNock
				.get("/user/memberships/orgs/fake-account")
				.reply(200, organizationAdminResponse);

			jiraNock
				.put("/rest/atlassian-connect/latest/addons/com.github.integration.test-atlassian-instance/properties/is-configured", { "isConfigured": "true" })
				.reply(200, "OK");

			const hashedJiraClientKey = "hashed-a-unique-client-key-" + new Date().getTime();
			await client.appProperties.create("true");

			await supertest(frontendApp)
				.post("/github/configuration")
				.send({
					installationId: 1,
					clientKey: hashedJiraClientKey
				})
				.type("form")
				.set(
					"Cookie",
					getSignedCookieHeader({
						githubToken: "test-github-token",
						jiraHost
					})
				)
				.expect(200);

			const subInDB = await Subscription.getAllForClientKey(hashedJiraClientKey);
			expect(subInDB.length).toBe(1);
			expect(subInDB[0]).toEqual(expect.objectContaining({
				gitHubInstallationId: 1,
				jiraClientKey: hashedJiraClientKey,
				plainClientKey: null
			}));
		});
	});
});

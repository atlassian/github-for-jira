import { ViewerRepositoryCountQuery } from "~/src/github/client/github-queries";
import supertest from "supertest";
import { generateSignedSessionCookieHeader } from "test/utils/cookies";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { Application } from "express";
import { getFrontendApp } from "~/src/app";
import { booleanFlag, BooleanFlags, stringFlag, StringFlags } from "config/feature-flags";
import { when } from "jest-when";
import { envVars } from "config/env";
import { GitHubServerApp } from "models/github-server-app";

jest.mock("config/feature-flags");

describe("github-configuration-get", () => {
	let installation: Installation;
	let subscription: Subscription;
	let app: Application;

	beforeEach(async () => {
		const result = await new DatabaseStateCreator().create();
		installation = result.installation;
		subscription = result.subscription;
		app = getFrontendApp();

		when(booleanFlag).calledWith(BooleanFlags.ENABLE_SUBSCRIPTION_DEFERRED_INSTALL, installation.jiraHost).mockResolvedValue(true);
		when(stringFlag).calledWith(StringFlags.GITHUB_SCOPES, expect.anything(), expect.anything()).mockResolvedValue("user,repo");
	});

	describe("cloud", () => {
		it("should render deferred installation link for disabled orgs", async () => {
			githubNock
				.get("/")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);

			githubNock
				.get("/user")
				.reply(200, { login: "test-user" });

			githubUserTokenNock(subscription.gitHubInstallationId);

			githubNock
				.get(`/user/installations?per_page=100`)
				.reply(200, {
					installations: [{
						id: subscription.gitHubInstallationId,
						account: {
							login: "test-org"
						},
						target_type: "Organization"
					}]
				});

			githubNock
				.get(`/user/memberships/orgs/test-org`)
				.reply(200, {
					role: "user"
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

			const response = await supertest(app)
				.get("/github/configuration")
				.set(
					"Cookie",
					generateSignedSessionCookieHeader({
						jiraHost: installation.jiraHost,
						githubToken: "token"
					})
				);
			expect(response.status).toStrictEqual(200);

			const url = response.text.match(/data-deferred-install-url="([^"]+)"/)![1];
			expect(url).toContain(`${envVars.APP_URL}/github/subscription-deferred-install/request`);

			const deferredInstallResponse = await supertest(app).get(url.replace(envVars.APP_URL, ""));
			expect(deferredInstallResponse.status).toStrictEqual(302);
			expect(deferredInstallResponse.headers.location).toContain("https://github.com/login/oauth/authorize?client_id=");
		});
	});

	describe("server", () => {
		let gitHubServerApp: GitHubServerApp;

		beforeEach(async () => {
			gitHubServerApp = await DatabaseStateCreator.createServerApp(installation.id);
		});

		it("should render deferred installation link for disabled orgs", async () => {
			gheNock
				.get("/api/v3")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);

			gheApiNock
				.get("/user")
				.reply(200, { login: "test-user" });

			gheUserTokenNock(subscription.gitHubInstallationId);

			gheApiNock
				.get(`/user/installations?per_page=100`)
				.reply(200, {
					installations: [{
						id: subscription.gitHubInstallationId,
						account: {
							login: "test-org"
						},
						target_type: "Organization"
					}]
				});

			gheApiNock
				.get(`/user/memberships/orgs/test-org`)
				.reply(200, {
					role: "user"
				});

			gheNock
				.post("/api/graphql", { query: ViewerRepositoryCountQuery })
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

			const response = await supertest(app)
				.get(`/github/${gitHubServerApp.uuid}/configuration`)
				.set(
					"Cookie",
					generateSignedSessionCookieHeader({
						jiraHost: installation.jiraHost,
						githubToken: "token",
						gitHubUuid: gitHubServerApp.uuid
					})
				);
			expect(response.status).toStrictEqual(200);

			const url = response.text.match(/data-deferred-install-url="([^"]+)"/)![1];
			expect(url).toContain(`${envVars.APP_URL}/github/${gitHubServerApp.uuid}/subscription-deferred-install/request/`);

			const deferredInstallResponse = await supertest(app).get(url.replace(envVars.APP_URL, ""));
			expect(deferredInstallResponse.status).toStrictEqual(302);
			expect(deferredInstallResponse.headers.location).toContain(`${gitHubServerApp.gitHubBaseUrl}/login/oauth/authorize?client_id=`);
		});
	});

});

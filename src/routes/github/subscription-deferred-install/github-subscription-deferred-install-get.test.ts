import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { GitHubServerApp } from "models/github-server-app";
import {
	registerSubscriptionDeferredInstallPayloadRequest,
	SubscriptionDeferredInstallPayload
} from "services/subscription-deferred-install-service";
import { Subscription } from "models/subscription";
import supertest from "supertest";
import { booleanFlag, BooleanFlags, stringFlag, StringFlags } from "config/feature-flags";
import { when } from "jest-when";
import { generateSignedSessionCookieHeader } from "test/utils/cookies";
import { hasAdminAccess } from "services/subscription-installation-service";

jest.mock("config/feature-flags");
jest.mock("services/subscription-installation-service");

describe("github-subscription-deferred-install-get", () => {
	let app;
	let installation: Installation;
	let subscription: Subscription;

	let payload: SubscriptionDeferredInstallPayload;

	beforeEach(async () => {
		app = getFrontendApp();
		const result = await new DatabaseStateCreator().forServer().create();
		installation = result.installation;
		subscription = result.subscription;

		payload = {
			installationIdPk: installation.id,
			gitHubInstallationId: subscription.gitHubInstallationId + 1,
			orgName: "myOrgName"
		};

		when(booleanFlag).calledWith(BooleanFlags.ENABLE_SUBSCRIPTION_DEFERRED_INSTALL, installation.jiraHost).mockResolvedValue(true);
		when(stringFlag).calledWith(StringFlags.GITHUB_SCOPES, expect.anything(), expect.anything()).mockResolvedValue("user,repo");
	});

	describe("cloud", () => {

		it("should not allow call with invalid payload", async () => {
			const payload = {
				foo: "bar"
			} as unknown as SubscriptionDeferredInstallPayload;

			const result = await supertest(app)
				.get(`/github/subscription-deferred-install/request/${await registerSubscriptionDeferredInstallPayloadRequest(payload)}`);
			expect(result.status).toStrictEqual(400);
			expect(result.body.error).toStrictEqual("Invalid payload");
		});

		it("should not allow call with corrupted payload", async () => {
			const result = await supertest(app)
				.get(`/github/subscription-deferred-install/request/boom`);
			expect(result.status).toStrictEqual(400);
			expect(result.body.error).toStrictEqual("Invalid payload");
		});

		it("should validate UUID and not allow call if belongs to a different GitHub server", async () => {
			const gitHubServerApp = await DatabaseStateCreator.createServerApp(installation.id);
			const result = await supertest(app)
				.get(`/github/${gitHubServerApp.uuid}/subscription-deferred-install/request/${await registerSubscriptionDeferredInstallPayloadRequest(payload)}`);
			expect(result.status).toStrictEqual(400);
			expect(result.body.error).toStrictEqual("Invalid payload");
		});

		it("should redirect to GitHub when not user token", async () => {
			const result = await supertest(app)
				.get(`/github/subscription-deferred-install/request/${await registerSubscriptionDeferredInstallPayloadRequest(payload)}`);
			expect(result.status).toStrictEqual(302);
			expect(result.headers.location).toContain(`https://github.com/login/oauth/authorize?client_id=`);
		});

		it("should render info about the payload if the user is an admin", async () => {
			githubNock
				.get(/.*/)
				.matchHeader("Authorization", "Bearer myToken")
				.reply(200);

			when(hasAdminAccess)
				.calledWith("myToken", installation.jiraHost, payload.gitHubInstallationId, expect.anything(), undefined)
				.mockResolvedValue(true);

			const result = await supertest(app)
				.get(`/github/subscription-deferred-install/request/${await registerSubscriptionDeferredInstallPayloadRequest(payload)}`)
				.set("Cookie", generateSignedSessionCookieHeader({
					githubToken: "myToken"
				}));

			expect(result.status).toStrictEqual(200);
			expect(result.text).toContain(`Do you approve connecting ${payload.orgName} (https://github.com) to ${installation.jiraHost}?`);
		});

		it("should return 401 if not GitHub admin", async () => {
			githubNock
				.get(/.*/)
				.matchHeader("Authorization", "Bearer myToken")
				.reply(200);

			when(hasAdminAccess)
				.calledWith("myToken", installation.jiraHost, payload.gitHubInstallationId, expect.anything(), undefined)
				.mockResolvedValue(false);

			const result = await supertest(app)
				.get(`/github/subscription-deferred-install/request/${await registerSubscriptionDeferredInstallPayloadRequest(payload)}`)
				.set("Cookie", generateSignedSessionCookieHeader({
					githubToken: "myToken"
				}));

			expect(result.status).toStrictEqual(401);
		});
	});

	describe("server", () => {
		let gitHubServerApp: GitHubServerApp;

		beforeEach(async () => {
			gitHubServerApp = await DatabaseStateCreator.createServerApp(installation.id);
			payload.gitHubServerAppIdPk = gitHubServerApp.id;
		});

		it("should not allow call with invalid payload", async () => {
			const payload = {
				foo: "bar"
			} as unknown as SubscriptionDeferredInstallPayload;

			const result = await supertest(app)
				.get(`/github/${gitHubServerApp.uuid}/subscription-deferred-install/request/${await registerSubscriptionDeferredInstallPayloadRequest(payload)}`);
			expect(result.status).toStrictEqual(400);
			expect(result.body.error).toStrictEqual("Invalid payload");
		});

		it("should not allow call with corrupted payload", async () => {
			const result = await supertest(app)
				.get(`/github/${gitHubServerApp.uuid}/subscription-deferred-install/request/boom`);
			expect(result.status).toStrictEqual(400);
			expect(result.body.error).toStrictEqual("Invalid payload");
		});

		it("should validate UUID and not allow call if belongs to a different GitHub server", async () => {
			const result = await supertest(app)
				.get(`/github/subscription-deferred-install/request/${await registerSubscriptionDeferredInstallPayloadRequest(payload)}`);
			expect(result.status).toStrictEqual(400);
			expect(result.body.error).toStrictEqual("Invalid payload");
		});

		it("should redirect to GitHub when not user token", async () => {
			const result = await supertest(app)
				.get(`/github/${gitHubServerApp.uuid}/subscription-deferred-install/request/${await registerSubscriptionDeferredInstallPayloadRequest(payload)}`);
			expect(result.status).toStrictEqual(302);
			expect(result.headers.location).toContain(`${gitHubServerApp.gitHubBaseUrl}/login/oauth/authorize?client_id=`);
		});

		it("should render info about the payload if the user is an admin", async () => {
			gheNock
				.get("/api/v3")
				.matchHeader("Authorization", "Bearer myToken")
				.reply(200);

			when(hasAdminAccess)
				.calledWith("myToken", installation.jiraHost, payload.gitHubInstallationId, expect.anything(), gitHubServerApp.id)
				.mockResolvedValue(true);

			const result = await supertest(app)
				.get(`/github/${gitHubServerApp.uuid}/subscription-deferred-install/request/${await registerSubscriptionDeferredInstallPayloadRequest(payload)}`)
				.set("Cookie", generateSignedSessionCookieHeader({
					githubToken: "myToken",
					gitHubUuid: gitHubServerApp.uuid
				}));

			expect(result.status).toStrictEqual(200);
			expect(result.text).toContain(`Do you approve connecting ${payload.orgName} (${gitHubServerApp.gitHubBaseUrl}) to ${installation.jiraHost}?`);
		});

		it("should return 401 if not GitHub admin", async () => {
			gheNock
				.get("/api/v3")
				.matchHeader("Authorization", "Bearer myToken")
				.reply(200);

			when(hasAdminAccess)
				.calledWith("myToken", installation.jiraHost, payload.gitHubInstallationId, expect.anything(), gitHubServerApp.id)
				.mockResolvedValue(false);

			const result = await supertest(app)
				.get(`/github/${gitHubServerApp.uuid}/subscription-deferred-install/request/${await registerSubscriptionDeferredInstallPayloadRequest(payload)}`)
				.set("Cookie", generateSignedSessionCookieHeader({
					githubToken: "myToken",
					gitHubUuid: gitHubServerApp.uuid
				}));

			expect(result.status).toStrictEqual(401);
		});
	});

});

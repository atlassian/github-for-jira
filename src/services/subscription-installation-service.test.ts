import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";
import { getLogger } from "config/logger";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { GitHubServerApp } from "models/github-server-app";
import { envVars } from "config/env";

jest.mock("~/src/sync/sync-utils");

describe("subscription-installation-service", () => {
	let installation: Installation;
	let subscription: Subscription;

	beforeEach(async () => {
		const result = await new DatabaseStateCreator().create();
		installation = result.installation;
		subscription = result.subscription;
	});

	describe("cloud", () => {

		it("returns a error when GitHub errors out", async () => {
			githubNock
				.get("/user")
				.matchHeader("Authorization", "token myToken")
				.reply(500, {
					login: "my-user"
				});

			const result = await verifyAdminPermsAndFinishInstallation(
				"myToken",
				installation,
				undefined,
				subscription.gitHubInstallationId + 1,
				getLogger("test")
			);
			expect(result.error).toBeDefined();
		});

		it("returns a error when the app was installed in User's org", async () => {
			githubNock
				.get("/user")
				.matchHeader("Authorization", "token myToken")
				.reply(200, {
					login: "my-user"
				});

			githubNock
				.get("/app/installations/" + (subscription.gitHubInstallationId + 1))
				.matchHeader("Authorization", /^Bearer .+$/)
				.reply(200, {
					account: {
						login: "my-org"
					},
					target_type: "User"
				});
			const result = await verifyAdminPermsAndFinishInstallation(
				"myToken",
				installation,
				undefined,
				subscription.gitHubInstallationId + 1,
				getLogger("test")
			);
			expect(result.error).toBeDefined();
		});

		it("returns a error when the the user is not an admin", async () => {
			githubNock
				.get("/user")
				.matchHeader("Authorization", "token myToken")
				.reply(200, {
					login: "my-user"
				});

			githubNock
				.get("/user/memberships/orgs/my-org")
				.matchHeader("Authorization", "token myToken")
				.reply(200, {
					role: "user"
				});

			githubNock
				.get("/app/installations/" + (subscription.gitHubInstallationId + 1))
				.matchHeader("Authorization", /^Bearer .+$/)
				.reply(200, {
					account: {
						login: "my-org"
					},
					target_type: "org"
				});
			const result = await verifyAdminPermsAndFinishInstallation(
				"myToken",
				installation,
				undefined,
				subscription.gitHubInstallationId + 1,
				getLogger("test")
			);
			expect(result.error).toBeDefined();
		});

		it("on success: creates a Db record, kicks off sync and updates isConfigured state", async () => {
			githubNock
				.get("/user")
				.matchHeader("Authorization", "token myToken")
				.reply(200, {
					login: "my-user"
				});

			githubNock
				.get("/user/memberships/orgs/my-org")
				.matchHeader("Authorization", "token myToken")
				.reply(200, {
					role: "admin"
				});

			githubNock
				.get("/app/installations/" + (subscription.gitHubInstallationId + 1))
				.matchHeader("Authorization", /^Bearer .+$/)
				.reply(200, {
					account: {
						login: "my-org"
					},
					target_type: "org"
				});

			jiraNock
				.put(`/rest/atlassian-connect/latest/addons/${envVars.APP_KEY}/properties/is-configured`)
				.reply(200);

			const result = await verifyAdminPermsAndFinishInstallation(
				"myToken",
				installation,
				undefined,
				subscription.gitHubInstallationId + 1,
				getLogger("test")
			);

			expect(result.error).not.toBeDefined();
			expect(await Subscription.findOneForGitHubInstallationId(subscription.gitHubInstallationId + 1, undefined)).toBeDefined();
			expect(findOrStartSync).toBeCalledWith(expect.objectContaining({
				gitHubInstallationId: subscription.gitHubInstallationId + 1
			}), expect.anything(), "full", undefined, undefined, {
				source: "initial-sync"
			});
		});
	});

	describe("server", () => {
		let gitHubServerApp: GitHubServerApp;

		beforeEach(async () => {
			gitHubServerApp = await DatabaseStateCreator.createServerApp(installation.id);
		});

		it("returns a error when GitHub errors out", async () => {
			gheApiNock
				.get("/user")
				.matchHeader("Authorization", "token myToken")
				.reply(500, {
					login: "my-user"
				});

			const result = await verifyAdminPermsAndFinishInstallation(
				"myToken",
				installation,
				gitHubServerApp.id,
				subscription.gitHubInstallationId + 1,
				getLogger("test")
			);
			expect(result.error).toBeDefined();
		});

		it("returns a error when the app was installed in User's org", async () => {
			gheApiNock
				.get("/user")
				.matchHeader("Authorization", "token myToken")
				.reply(200, {
					login: "my-user"
				});

			gheApiNock
				.get("/app/installations/" + (subscription.gitHubInstallationId + 1))
				.matchHeader("Authorization", /^Bearer .+$/)
				.reply(200, {
					account: {
						login: "my-org"
					},
					target_type: "User"
				});
			const result = await verifyAdminPermsAndFinishInstallation(
				"myToken",
				installation,
				gitHubServerApp.id,
				subscription.gitHubInstallationId + 1,
				getLogger("test")
			);
			expect(result.error).toBeDefined();
		});

		it("returns a error when the the user is not an admin", async () => {
			gheApiNock
				.get("/user")
				.matchHeader("Authorization", "token myToken")
				.reply(200, {
					login: "my-user"
				});

			gheApiNock
				.get("/user/memberships/orgs/my-org")
				.matchHeader("Authorization", "token myToken")
				.reply(200, {
					role: "user"
				});

			gheApiNock
				.get("/app/installations/" + (subscription.gitHubInstallationId + 1))
				.matchHeader("Authorization", /^Bearer .+$/)
				.reply(200, {
					account: {
						login: "my-org"
					},
					target_type: "org"
				});
			const result = await verifyAdminPermsAndFinishInstallation(
				"myToken",
				installation,
				gitHubServerApp.id,
				subscription.gitHubInstallationId + 1,
				getLogger("test")
			);
			expect(result.error).toBeDefined();
		});

		it("on success: creates a Db record, kicks off sync and updates isConfigured state", async () => {
			gheApiNock
				.get("/user")
				.matchHeader("Authorization", "token myToken")
				.reply(200, {
					login: "my-user"
				});

			gheApiNock
				.get("/user/memberships/orgs/my-org")
				.matchHeader("Authorization", "token myToken")
				.reply(200, {
					role: "admin"
				});

			gheApiNock
				.get("/app/installations/" + (subscription.gitHubInstallationId + 1))
				.matchHeader("Authorization", /^Bearer .+$/)
				.reply(200, {
					account: {
						login: "my-org"
					},
					target_type: "org"
				});
			jiraNock
				.put(`/rest/atlassian-connect/latest/addons/${envVars.APP_KEY}/properties/is-configured`)
				.reply(200);
			const result = await verifyAdminPermsAndFinishInstallation(
				"myToken",
				installation,
				gitHubServerApp.id,
				subscription.gitHubInstallationId + 1,
				getLogger("test")
			);
			expect(result.error).not.toBeDefined();
			expect(await Subscription.findOneForGitHubInstallationId(subscription.gitHubInstallationId + 1, gitHubServerApp.id)).toBeDefined();
			expect(findOrStartSync).toBeCalledWith(expect.objectContaining({
				gitHubInstallationId: subscription.gitHubInstallationId + 1
			}), expect.anything(), "full", undefined, undefined, {
				source: "initial-sync"
			});
		});
	});
});

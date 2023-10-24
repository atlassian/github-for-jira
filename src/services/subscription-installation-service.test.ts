import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { hasAdminAccess, verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";
import { getLogger } from "config/logger";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { GitHubServerApp } from "models/github-server-app";
import { envVars } from "config/env";
import { BooleanFlags, booleanFlag } from "~/src/config/feature-flags";
import { when } from "jest-when";

jest.mock("~/src/sync/sync-utils");
jest.mock("~/src/config/feature-flags");

describe("subscription-installation-service", () => {
	let installation: Installation;
	let subscription: Subscription;

	beforeEach(async () => {
		const result = await new DatabaseStateCreator().create();
		installation = result.installation;
		subscription = result.subscription;
	});

	const mockGitHub = (config: {
		isGhe: boolean, is500Error: boolean, isInstalledInUserSpace?: boolean, isAdmin?: boolean, gitHubInstallationId?: number, fetchAvatar?: boolean
	}) => {
		const cloudOrGheNock = config.isGhe ? gheApiNock : githubNock;
		const gitHubInstallationId = config.gitHubInstallationId || (subscription.gitHubInstallationId + 1);
		cloudOrGheNock
			.get("/user")
			.matchHeader("Authorization", "token myToken")
			.reply(config.is500Error ? 500 : 200, {
				login: "my-user"
			});

		if (config.isInstalledInUserSpace !== undefined) {
			cloudOrGheNock
				.get("/app/installations/" + gitHubInstallationId.toString())
				.matchHeader("Authorization", /^Bearer .+$/)
				.reply(200, {
					account: {
						login: "my-org"
					},
					target_type: config.isInstalledInUserSpace ? "User" : "org"
				});
		}

		if (config.fetchAvatar === true) {
			cloudOrGheNock
				.get("/app/installations/" + gitHubInstallationId.toString())
				.matchHeader("Authorization", /^Bearer .+$/)
				.reply(200, {
					account: {
						avatarUrl: "www.test.url.com"
					}
				});
		}

		if (config.isAdmin !== undefined) {
			cloudOrGheNock
				.get("/user/memberships/orgs/my-org")
				.matchHeader("Authorization", "token myToken")
				.reply(200, {
					role: config.isAdmin ? "admin" : "user"
				});
		}
	};


	describe("verifyAdminPermsAndFinishInstallation", () => {

		describe("cloud", () => {

			it("returns a error when GitHub errors out", async () => {
				mockGitHub({
					isGhe: false,
					is500Error: true
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
				mockGitHub({
					isGhe: false,
					is500Error: false,
					isInstalledInUserSpace: true
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
				mockGitHub({
					isGhe: false,
					is500Error: false,
					isInstalledInUserSpace: false,
					isAdmin: false
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
				mockGitHub({
					isGhe: false,
					is500Error: false,
					isInstalledInUserSpace: false,
					fetchAvatar: false,
					isAdmin: true
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

			it("on success with ENABLE_GITHUB_SECURITY_IN_JIRA FF is on: creates a Db record, kicks off sync and updates isConfigured state", async () => {
				when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, installation.jiraHost).mockResolvedValue(true);
				mockGitHub({
					isGhe: false,
					is500Error: false,
					isInstalledInUserSpace: false,
					fetchAvatar: true,
					isAdmin: true
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
				mockGitHub({
					isGhe: true,
					is500Error: true
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
				mockGitHub({
					isGhe: true,
					is500Error: false,
					isInstalledInUserSpace: true
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
				mockGitHub({
					isGhe: true,
					is500Error: false,
					isInstalledInUserSpace: false,
					isAdmin: false
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
				mockGitHub({
					isGhe: true,
					is500Error: false,
					isInstalledInUserSpace: false,
					fetchAvatar: false,
					isAdmin: true
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
			it("on success with ENABLE_GITHUB_SECURITY_IN_JIRA FF is on: creates a Db record, kicks off sync and updates isConfigured state", async () => {
				when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, installation.jiraHost).mockResolvedValue(true);
				mockGitHub({
					isGhe: true,
					is500Error: false,
					isInstalledInUserSpace: false,
					fetchAvatar: true,
					isAdmin: true
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

	describe("hasAdminAccess", () => {
		describe("cloud", () => {
			it("returns false github throws a error", async () => {
				mockGitHub({
					isGhe: false,
					is500Error: true
				});
				const result = await hasAdminAccess(
					"myToken",
					installation.jiraHost,
					subscription.gitHubInstallationId + 1,
					getLogger("test")
				);
				expect(result).toStrictEqual(false);
			});

			it("returns false when the app was installed in User's org", async () => {
				mockGitHub({
					isGhe: false,
					is500Error: false,
					isInstalledInUserSpace: true
				});
				const result = await hasAdminAccess(
					"myToken",
					installation.jiraHost,
					subscription.gitHubInstallationId + 1,
					getLogger("test")
				);
				expect(result).toStrictEqual(false);
			});

			it("returns false when the user is not an admin", async () => {
				mockGitHub({
					isGhe: false,
					is500Error: false,
					isInstalledInUserSpace: false,
					isAdmin: false
				});
				const result = await hasAdminAccess(
					"myToken",
					installation.jiraHost,
					subscription.gitHubInstallationId + 1,
					getLogger("test")
				);
				expect(result).toStrictEqual(false);
			});

			it("returns true when the user is an admin", async () => {
				mockGitHub({
					isGhe: false,
					is500Error: false,
					isInstalledInUserSpace: false,
					isAdmin: true
				});
				const result = await hasAdminAccess(
					"myToken",
					installation.jiraHost,
					subscription.gitHubInstallationId + 1,
					getLogger("test")
				);
				expect(result).toStrictEqual(true);
			});
		});

		describe("server", () => {
			let gitHubServerApp: GitHubServerApp;

			beforeEach(async () => {
				gitHubServerApp = await DatabaseStateCreator.createServerApp(installation.id);
			});

			it("returns false github throws a error", async () => {
				mockGitHub({
					isGhe: true,
					is500Error: true
				});
				const result = await hasAdminAccess(
					"myToken",
					installation.jiraHost,
					subscription.gitHubInstallationId + 1,
					getLogger("test"),
					gitHubServerApp.id
				);
				expect(result).toStrictEqual(false);
			});

			it("returns false when the app was installed in User's org", async () => {
				mockGitHub({
					isGhe: true,
					is500Error: false,
					isInstalledInUserSpace: true
				});
				const result = await hasAdminAccess(
					"myToken",
					installation.jiraHost,
					subscription.gitHubInstallationId + 1,
					getLogger("test"),
					gitHubServerApp.id
				);
				expect(result).toStrictEqual(false);
			});

			it("returns false when the user is not an admin", async () => {
				mockGitHub({
					isGhe: true,
					is500Error: false,
					isInstalledInUserSpace: false,
					isAdmin: false
				});
				const result = await hasAdminAccess(
					"myToken",
					installation.jiraHost,
					subscription.gitHubInstallationId + 1,
					getLogger("test"),
					gitHubServerApp.id
				);
				expect(result).toStrictEqual(false);
			});

			it("returns true when the user is an admin", async () => {
				mockGitHub({
					isGhe: true,
					is500Error: false,
					isInstalledInUserSpace: false,
					isAdmin: true
				});
				const result = await hasAdminAccess(
					"myToken",
					installation.jiraHost,
					subscription.gitHubInstallationId + 1,
					getLogger("test"),
					gitHubServerApp.id
				);
				expect(result).toStrictEqual(true);
			});
		});
	});
});

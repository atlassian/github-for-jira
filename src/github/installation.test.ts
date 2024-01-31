import { when } from "jest-when";
import { envVars } from "../config/env";
import { getLogger } from "../config/logger";
import { Installation } from "../models/installation";
import { Subscription } from "../models/subscription";
import { WebhookContext } from "../routes/github/webhook/webhook-context";
import { GITHUB_CLOUD_API_BASEURL, GITHUB_CLOUD_BASEURL } from "./client/github-client-constants";
import { installationWebhookHandler } from "./installation";
import { BooleanFlags, booleanFlag } from "../config/feature-flags";
import { submitSecurityWorkspaceToLink } from "../services/subscription-installation-service";
import { GitHubServerApp } from "../models/github-server-app";
import { v4 as uuid } from "uuid";
import { findOrStartSync } from "../sync/sync-utils";

jest.mock("utils/webhook-utils");
jest.mock("config/feature-flags");
jest.mock("services/subscription-installation-service");
jest.mock("../sync/sync-utils");

const GITHUB_INSTALLATION_ID = 1234;
const GHES_GITHUB_APP_ID = 111;
const GHES_GITHUB_UUID = "xxx-xxx-xxx-xxx";
const GHES_GITHUB_APP_CLIENT_ID = "client-id";

describe("InstallationWebhookHandler", () => {
	let jiraClient: any;
	let util: any;
	let gitHubServerApp;
	let ghesGitHubAppId;

	describe("GitHub Cloud", () => {

		beforeEach(async () => {
			jiraClient = { baseURL: jiraHost };
			util = null;

			await Subscription.create({
				gitHubInstallationId: GITHUB_INSTALLATION_ID,
				jiraHost
			});

			await Installation.create({
				jiraHost,
				clientKey: "client-key",
				encryptedSharedSecret: "shared-secret"
			});

			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);

		});

		describe.each(
			["new_permissions_accepted"]
		)("should not set security permissions accepted field in subscriptions when FF is disabled", (action) => {
			it(`${action} action`, async () => {
				when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(false);
				await installationWebhookHandler(getWebhookContext({ cloud: true, action }), jiraClient, util, GITHUB_INSTALLATION_ID);
				const subscription = await Subscription.findOneForGitHubInstallationId(GITHUB_INSTALLATION_ID, undefined);
				expect(subscription?.isSecurityPermissionsAccepted).toBeFalsy();

			});
		});
		describe.each(
			["new_permissions_accepted"]
		)("should set security permissions accepted field in subscriptions", (action) => {
			it(`${action} action`, async () => {
				await installationWebhookHandler(getWebhookContext({ cloud: true, action }), jiraClient, util, GITHUB_INSTALLATION_ID);
				const subscription = await Subscription.findOneForGitHubInstallationId(GITHUB_INSTALLATION_ID, undefined);
				expect(subscription?.isSecurityPermissionsAccepted).toBeTruthy();

			});
		});

		it("should not set security permissions accepted field if the payload doesn't contain secret_scanning_alerts permission", async () => {
			const webhookContext = getWebhookContext({ cloud: true });
			delete webhookContext.payload.installation.permissions.secret_scanning_alerts;
			await installationWebhookHandler(webhookContext, jiraClient, util, GITHUB_INSTALLATION_ID);
			const subscription = await Subscription.findOneForGitHubInstallationId(GITHUB_INSTALLATION_ID, undefined);
			expect(subscription?.isSecurityPermissionsAccepted).toBeFalsy();

		});

		it("should not set security permissions accepted field if the payload doesn't contain security_events permission", async () => {
			const webhookContext = getWebhookContext({ cloud: true });
			delete webhookContext.payload.installation.permissions.security_events;
			await installationWebhookHandler(webhookContext, jiraClient, util, GITHUB_INSTALLATION_ID);
			const subscription = await Subscription.findOneForGitHubInstallationId(GITHUB_INSTALLATION_ID, undefined);
			expect(subscription?.isSecurityPermissionsAccepted).toBeFalsy();

		});

		it("should not set security permissions accepted field if the payload doesn't contain vulnerability_alerts permission", async () => {
			const webhookContext = getWebhookContext({ cloud: true });
			delete webhookContext.payload.installation.permissions.vulnerability_alerts;
			await installationWebhookHandler(webhookContext, jiraClient, util, GITHUB_INSTALLATION_ID);
			const subscription = await Subscription.findOneForGitHubInstallationId(GITHUB_INSTALLATION_ID, undefined);
			expect(subscription?.isSecurityPermissionsAccepted).toBeFalsy();

		});

		it("should not set security permissions accepted field if the payload doesn't contain security events", async () => {
			const webhookContext = getWebhookContext({ cloud: true });
			webhookContext.payload.installation.events = [];
			await installationWebhookHandler(webhookContext, jiraClient, util, GITHUB_INSTALLATION_ID);
			const subscription = await Subscription.findOneForGitHubInstallationId(GITHUB_INSTALLATION_ID, undefined);
			expect(subscription?.isSecurityPermissionsAccepted).toBeFalsy();

		});

		it("should submit workspace to link and trigger security backfill for new_permissions_accepted action", async () => {
			const webhookContext = getWebhookContext({ cloud: true });
			await installationWebhookHandler(webhookContext, jiraClient, util, GITHUB_INSTALLATION_ID);
			const subscription = await Subscription.findOneForGitHubInstallationId(GITHUB_INSTALLATION_ID, undefined);
			const installation = await Installation.getForHost(jiraHost);
			expect(submitSecurityWorkspaceToLink).toBeCalledTimes(1);
			expect(submitSecurityWorkspaceToLink).toBeCalledWith(installation, subscription, expect.anything());
			expect(findOrStartSync).toBeCalledTimes(1);
			expect(findOrStartSync).toBeCalledWith(
				subscription, expect.anything(), "full", subscription?.backfillSince, ["dependabotAlert", "secretScanningAlert", "codeScanningAlert"], { "source": "webhook-security-permissions-accepted" }
			);

		});

		it("should throw error if subscription is not found", async () => {
			const webhookContext = getWebhookContext({ cloud: true });
			await expect(installationWebhookHandler(webhookContext, jiraClient, util, 0)).rejects.toThrow("Subscription not found");
		});

	});
	describe("GitHub Enterprise Server", () => {

		beforeEach(async () => {
			jiraClient = { baseURL: jiraHost };
			util = null;

			await Installation.create({
				jiraHost,
				clientKey: "client-key",
				encryptedSharedSecret: "shared-secret"
			});

			gitHubServerApp = await GitHubServerApp.install({
				uuid: uuid(),
				appId: GHES_GITHUB_APP_ID,
				installationId: 456,
				gitHubAppName: "test-github-server-app",
				gitHubBaseUrl: gheUrl,
				gitHubClientId: "client-id",
				gitHubClientSecret: "client-secret",
				privateKey: "private-key",
				webhookSecret: "webhook-secret"
			}, jiraHost);
			ghesGitHubAppId = gitHubServerApp.id;
			await Subscription.create({
				gitHubInstallationId: GITHUB_INSTALLATION_ID,
				jiraHost,
				jiraClientKey: "client-key",
				gitHubAppId: gitHubServerApp.id
			});

			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);

		});
		describe.each(
			["new_permissions_accepted"]
		)("should not set security permissions accepted field in subscriptions when FF is disabled", (action) => {
			it(`${action} action`, async () => {
				when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(false);
				await installationWebhookHandler(getWebhookContext({ cloud: false, action }), jiraClient, util, GITHUB_INSTALLATION_ID);
				const subscription = await Subscription.findOneForGitHubInstallationId(GITHUB_INSTALLATION_ID, undefined);
				expect(subscription?.isSecurityPermissionsAccepted).toBeFalsy();

			});
		});

		describe.each(
			["new_permissions_accepted"]
		)("should set security permissions accepted field in subscriptions", (action) => {
			it(`${action} action`, async () => {
				await installationWebhookHandler(getWebhookContext({ cloud: false, action }), jiraClient, util, GITHUB_INSTALLATION_ID);
				const subscription = await Subscription.findOneForGitHubInstallationId(GITHUB_INSTALLATION_ID, ghesGitHubAppId);
				expect(subscription?.isSecurityPermissionsAccepted).toBeTruthy();

			});
		});

	});

	const getWebhookContext = ({ cloud, action = "new_permissions_accepted" }: { cloud: boolean, action?: string }) => {
		return new WebhookContext<any>({
			id: "1",
			name: "installation",
			log: getLogger("test"),
			action,
			payload: getPayload(),
			gitHubAppConfig: cloud ? {
				uuid: undefined,
				gitHubAppId: undefined,
				appId: parseInt(envVars.APP_ID),
				clientId: envVars.GITHUB_CLIENT_ID,
				gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
				gitHubApiUrl: GITHUB_CLOUD_API_BASEURL
			} : {
				uuid: GHES_GITHUB_UUID,
				gitHubAppId: ghesGitHubAppId,
				appId: GHES_GITHUB_APP_ID,
				clientId: GHES_GITHUB_APP_CLIENT_ID,
				gitHubBaseUrl: gheUrl,
				gitHubApiUrl: gheUrl
			}
		});
	};

	const getPayload = () => {
		return {
			"installation": {
				"id": GITHUB_INSTALLATION_ID,
				"permissions": {
					"issues": "write",
					"actions": "write",
					"contents": "write",
					"metadata": "read",
					"workflows": "write",
					"deployments": "write",
					"pull_requests": "write",
					"security_events": "read",
					"vulnerability_alerts": "read",
					"secret_scanning_alerts": "read"
				},
				"events": ["secret_scanning_alert", "code_scanning_alert", "dependabot_alert"]
			}
		};
	};

});
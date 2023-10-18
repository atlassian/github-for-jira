import { DatabaseStateCreator } from "~/test/utils/database-state-creator";
import secretScanningAlerts from "fixtures/api/secret-scanning-alerts.json";
import { processInstallation } from "./installation";
import { Hub } from "@sentry/node";
import { getLogger } from "../config/logger";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import { waitUntil } from "~/test/utils/wait-until";
import { BooleanFlags, booleanFlag } from "../config/feature-flags";
import { when } from "jest-when";
import { GitHubServerApp } from "../models/github-server-app";
import { Subscription } from "../models/subscription";


jest.mock("config/feature-flags");
describe("sync/secret-scanning-alerts", () => {

	const sentry: Hub = { setUser: jest.fn() } as any;
	const MOCK_SYSTEM_TIMESTAMP_SEC = 12345678;
	let subscription;


	describe("cloud", () => {

		const mockBackfillQueueSendMessage = jest.fn();

		const verifyMessageSent = async (data: BackfillMessagePayload, delaySec?: number) => {
			await waitUntil(async () => {
				expect(githubNock).toBeDone();
				expect(jiraNock).toBeDone();
			});
			expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(1);
			expect(mockBackfillQueueSendMessage.mock.calls[0][0]).toEqual(data);
			expect(mockBackfillQueueSendMessage.mock.calls[0][1]).toEqual(delaySec || 0);
		};
		beforeEach(async () => {

			const builderResult = await new DatabaseStateCreator()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForSecretScanningAlerts()
				.withSecurityPermissionsAccepted()
				.create();
			subscription = builderResult.subscription;

			mockSystemTime(MOCK_SYSTEM_TIMESTAMP_SEC);

		});
		it("should send secret scanning alerts to Jira", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/secret-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(200, secretScanningAlerts);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			jiraNock
				.post("/rest/security/1.0/bulk", expectedResponseCloudServer(subscription))
				.reply(200);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should not send secret scanning alerts to Jira if FF is disabled", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(false);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			expect(mockBackfillQueueSendMessage).not.toBeCalled();
		});

		it("should not call Jira if no secret scanning alerts are found", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/secret-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(200, []);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should handle secret scanning disabled error", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/secret-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(404, { message: "Secret scanning is disabled on this repository" });
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should handle 404 error", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/secret-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(404);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});
		it("should handle 451 error", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/secret-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(451, { message: "Not Found" });
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});
	});

	describe("server", () => {

		const verifyMessageSent = async (data: BackfillMessagePayload, delaySec?: number) => {
			await waitUntil(async () => {
				expect(gheNock).toBeDone();
				expect(jiraNock).toBeDone();
			});
			expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(1);
			expect(mockBackfillQueueSendMessage.mock.calls[0][0]).toEqual(data);
			expect(mockBackfillQueueSendMessage.mock.calls[0][1]).toEqual(delaySec || 0);
		};

		const mockBackfillQueueSendMessage = jest.fn();
		let gitHubServerApp: GitHubServerApp;

		beforeEach(async () => {

			const builderResult = await new DatabaseStateCreator()
				.forServer()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForSecretScanningAlerts()
				.withSecurityPermissionsAccepted()
				.create();
			subscription = builderResult.subscription;

			mockSystemTime(MOCK_SYSTEM_TIMESTAMP_SEC);

			gitHubServerApp = builderResult.gitHubServerApp!;
		});

		it("should send secret scanning alerts to Jira", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = {
				installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
				jiraHost,
				gitHubAppConfig: {
					uuid: gitHubServerApp.uuid,
					gitHubAppId: gitHubServerApp.id,
					appId: gitHubServerApp.appId,
					clientId: gitHubServerApp.gitHubClientId,
					gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
					gitHubApiUrl: gitHubServerApp.gitHubBaseUrl
				}
			};
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheNock
				.get("/api/v3/repos/integrations/test-repo-name/secret-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(200, secretScanningAlerts);
			jiraNock
				.post("/rest/security/1.0/bulk", expectedResponseGHEServer(subscription))
				.reply(200);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should not call Jira if no secret scanning alerts are found", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = {
				installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
				jiraHost,
				gitHubAppConfig: {
					uuid: gitHubServerApp.uuid,
					gitHubAppId: gitHubServerApp.id,
					appId: gitHubServerApp.appId,
					clientId: gitHubServerApp.gitHubClientId,
					gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
					gitHubApiUrl: gitHubServerApp.gitHubBaseUrl + "/v3/api"
				}
			};
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheNock
				.get("/api/v3/repos/integrations/test-repo-name/secret-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(200, []);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});
	});
});


const expectedResponseCloudServer = (subscription: Subscription) => ({
	"vulnerabilities": [
		{
			"schemaVersion": "1.0",
			"id": "s-1-12",
			"updateSequenceNumber": 12345678,
			"containerId": "1",
			"displayName": "GitHub Personal Access Token",
			"description": "**Vulnerability:** Fix GitHub Personal Access Token\n\n**State:** Open\n\n**Secret type:** github_personal_access_token\n\nVisit the vulnerability’s [secret scanning alert page](https://github.com/test-owner/sample-repo/security/secret-scanning/12) in GitHub to learn more about the potential active secret and remediation steps.",
			"url": "https://github.com/test-owner/sample-repo/security/secret-scanning/12",
			"type": "sast",
			"introducedDate": "2023-08-04T04:33:44Z",
			"lastUpdated": "2023-08-04T04:33:44Z",
			"severity": {
				"level": "critical"
			},
			"identifiers": [
				{
					"displayName": "github_personal_access_token",
					"url": "https://github.com/test-owner/sample-repo/security/secret-scanning/12"
				}
			],
			"status": "open"
		}

	],
	"properties": {
		"gitHubInstallationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID,
		"workspaceId": subscription.id
	},
	"operationType": "BACKFILL"
});

const expectedResponseGHEServer = (subscription: Subscription) => ({
	"vulnerabilities": [
		{
			"schemaVersion": "1.0",
			"id": "s-6769746875626d79646f6d61696e636f6d-1-12",
			"updateSequenceNumber": 12345678,
			"containerId": "6769746875626d79646f6d61696e636f6d-1",
			"displayName": "GitHub Personal Access Token",
			"description": "**Vulnerability:** Fix GitHub Personal Access Token\n\n**State:** Open\n\n**Secret type:** github_personal_access_token\n\nVisit the vulnerability’s [secret scanning alert page](https://github.com/test-owner/sample-repo/security/secret-scanning/12) in GitHub to learn more about the potential active secret and remediation steps.",
			"url": "https://github.com/test-owner/sample-repo/security/secret-scanning/12",
			"type": "sast",
			"introducedDate": "2023-08-04T04:33:44Z",
			"lastUpdated": "2023-08-04T04:33:44Z",
			"severity": {
				"level": "critical"
			},
			"identifiers": [
				{
					"displayName": "github_personal_access_token",
					"url": "https://github.com/test-owner/sample-repo/security/secret-scanning/12"
				}
			],
			"status": "open"
		}
	],
	"properties": {
		"gitHubInstallationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID,
		"workspaceId": subscription.id
	},
	"operationType": "BACKFILL"
});
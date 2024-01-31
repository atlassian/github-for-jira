import { DatabaseStateCreator } from "~/test/utils/database-state-creator";
import codeScanningAlerts from "fixtures/api/code-scanning-alerts.json";
import { processInstallation } from "./installation";
import { Hub } from "@sentry/node";
import { getLogger } from "../config/logger";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import { waitUntil } from "~/test/utils/wait-until";
import { BooleanFlags, booleanFlag } from "../config/feature-flags";
import { when } from "jest-when";
import { GitHubServerApp } from "../models/github-server-app";
import { Subscription } from "models/subscription";


jest.mock("config/feature-flags");
describe("sync/code-scanning-alerts", () => {

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
				.repoSyncStatePendingForCodeScanningAlerts()
				.withSecurityPermissionsAccepted()
				.create();
			subscription = builderResult.subscription;

			mockSystemTime(MOCK_SYSTEM_TIMESTAMP_SEC);

		});
		it("should send code scanning alerts to Jira", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/code-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(200, codeScanningAlerts);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			jiraNock
				.post("/rest/security/1.0/bulk", expectedResponseCloudServer(subscription))
				.reply(200);
			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should not send code scanning alerts to Jira if FF is disabled", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(false);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			expect(mockBackfillQueueSendMessage).not.toBeCalled();
		});

		it("should not call Jira if no code scanning alerts are found", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/code-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(200, []);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should handle code scanning disabled error", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/code-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(403, { message: "Code scanning is not enabled for this repository" });
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should handle GH advanced security disabled error", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/code-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(403, { message: "Advanced Security must be enabled for this repository to use code scanning" });
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should handle no analysis error", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/code-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(404, { message: "Ano analysis found" });
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should handle 404 error", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/code-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(404);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should handle 451 error", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/code-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(451);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
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
				.repoSyncStatePendingForCodeScanningAlerts()
				.withSecurityPermissionsAccepted()
				.create();
			subscription = builderResult.subscription;

			mockSystemTime(MOCK_SYSTEM_TIMESTAMP_SEC);

			gitHubServerApp = builderResult.gitHubServerApp!;
		});

		it("should send code scanning alerts to Jira", async () => {
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
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheNock
				.get("/api/v3/repos/integrations/test-repo-name/code-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(200, codeScanningAlerts);
			jiraNock
				.post("/rest/security/1.0/bulk", expectedResponseGHEServer(subscription))
				.reply(200);
			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should not call Jira if no code scanning alerts are found", async () => {
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
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheNock
				.get("/api/v3/repos/integrations/test-repo-name/code-scanning/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(200, []);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});
	});
});

const expectedResponseCloudServer = (subscription: Subscription) => ({
	"properties": {
		"gitHubInstallationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID,
		"workspaceId": subscription.id
	},
	"operationType": "BACKFILL",
	"vulnerabilities": [
		{
			"schemaVersion": "1.0",
			"id": "c-1-9",
			"updateSequenceNumber": 12345678,
			"containerId": "1",
			"displayName": "Reflected cross-site scripting",
			"description": "**Vulnerability:** Reflected cross-site scripting\n\n**Severity:** Medium\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Open\n\n**Weaknesses:** [CWE-79](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=79), [CWE-116](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=116)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/9) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/9",
			"type": "sast",
			"introducedDate": "2023-08-18T04:33:51Z",
			"lastUpdated": "2023-08-18T04:33:51Z",
			"severity": {
				"level": "medium"
			},
			"identifiers": [
				{
					"displayName": "CWE-79",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=79"
				},
				{
					"displayName": "CWE-116",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=116"
				}
			],
			"status": "open",
			"additionalInfo": {
				"content": "CodeQL"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "c-1-8",
			"updateSequenceNumber": 12345678,
			"containerId": "1",
			"displayName": "Hard-coded credentials",
			"description": "**Vulnerability:** Hard-coded credentials\n\n**Severity:** Critical\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Fixed\n\n**Weaknesses:** [CWE-259](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259), [CWE-321](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321), [CWE-798](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/8) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/8",
			"type": "sast",
			"introducedDate": "2023-08-18T04:15:14Z",
			"lastUpdated": "2023-08-18T04:33:51Z",
			"severity": {
				"level": "critical"
			},
			"identifiers": [
				{
					"displayName": "CWE-259",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259"
				},
				{
					"displayName": "CWE-321",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321"
				},
				{
					"displayName": "CWE-798",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798"
				}
			],
			"status": "closed",
			"additionalInfo": {
				"content": "CodeQL"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "c-1-7",
			"updateSequenceNumber": 12345678,
			"containerId": "1",
			"displayName": "Database query built from user-controlled sources",
			"description": "**Vulnerability:** Database query built from user-controlled sources\n\n**Severity:** High\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Open\n\n**Weaknesses:** [CWE-89](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=89), [CWE-90](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=90), [CWE-943](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=943)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/7) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/7",
			"type": "sast",
			"introducedDate": "2023-08-09T04:26:41Z",
			"lastUpdated": "2023-08-18T04:33:51Z",
			"severity": {
				"level": "high"
			},
			"identifiers": [
				{
					"displayName": "CWE-89",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=89"
				},
				{
					"displayName": "CWE-90",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=90"
				},
				{
					"displayName": "CWE-943",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=943"
				}
			],
			"status": "open",
			"additionalInfo": {
				"content": "CodeQL"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "c-1-6",
			"updateSequenceNumber": 12345678,
			"containerId": "1",
			"displayName": "Reflected cross-site scripting",
			"description": "**Vulnerability:** Reflected cross-site scripting\n\n**Severity:** Medium\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Fixed\n\n**Weaknesses:** [CWE-79](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=79), [CWE-116](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=116)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/6) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/6",
			"type": "sast",
			"introducedDate": "2023-08-09T04:26:41Z",
			"lastUpdated": "2023-08-18T04:13:04Z",
			"severity": {
				"level": "medium"
			},
			"identifiers": [
				{
					"displayName": "CWE-79",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=79"
				},
				{
					"displayName": "CWE-116",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=116"
				}
			],
			"status": "closed",
			"additionalInfo": {
				"content": "CodeQL"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "c-1-3",
			"updateSequenceNumber": 12345678,
			"containerId": "1",
			"displayName": "Hard-coded credentials",
			"description": "**Vulnerability:** Hard-coded credentials\n\n**Severity:** Critical\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Fixed\n\n**Weaknesses:** [CWE-259](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259), [CWE-321](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321), [CWE-798](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/3) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/3",
			"type": "sast",
			"introducedDate": "2023-08-03T05:47:19Z",
			"lastUpdated": "2023-08-18T04:13:04Z",
			"severity": {
				"level": "critical"
			},
			"identifiers": [
				{
					"displayName": "CWE-259",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259"
				},
				{
					"displayName": "CWE-321",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321"
				},
				{
					"displayName": "CWE-798",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798"
				}
			],
			"status": "closed",
			"additionalInfo": {
				"content": "CodeQL"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "c-1-2",
			"updateSequenceNumber": 12345678,
			"containerId": "1",
			"displayName": "Hard-coded credentials",
			"description": "**Vulnerability:** Hard-coded credentials\n\n**Severity:** Critical\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Fixed\n\n**Weaknesses:** [CWE-259](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259), [CWE-321](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321), [CWE-798](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/2) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/2",
			"type": "sast",
			"introducedDate": "2023-08-01T00:25:22Z",
			"lastUpdated": "2023-08-02T01:39:10Z",
			"severity": {
				"level": "critical"
			},
			"identifiers": [
				{
					"displayName": "CWE-259",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259"
				},
				{
					"displayName": "CWE-321",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321"
				},
				{
					"displayName": "CWE-798",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798"
				}
			],
			"status": "closed",
			"additionalInfo": {
				"content": "CodeQL"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "c-1-1",
			"updateSequenceNumber": 12345678,
			"containerId": "1",
			"displayName": "Hard-coded credentials",
			"description": "**Vulnerability:** Hard-coded credentials\n\n**Severity:** Critical\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Fixed\n\n**Weaknesses:** [CWE-259](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259), [CWE-321](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321), [CWE-798](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/1) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/1",
			"type": "sast",
			"introducedDate": "2023-07-31T06:37:26Z",
			"lastUpdated": "2023-07-31T06:47:39Z",
			"severity": {
				"level": "critical"
			},
			"identifiers": [
				{
					"displayName": "CWE-259",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259"
				},
				{
					"displayName": "CWE-321",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321"
				},
				{
					"displayName": "CWE-798",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798"
				}
			],
			"status": "closed",
			"additionalInfo": {
				"content": "CodeQL"
			}
		}
	]
});

const expectedResponseGHEServer = (subscription: Subscription) => ({
	"vulnerabilities": [
		{
			"schemaVersion": "1.0",
			"id": "c-6769746875626d79646f6d61696e636f6d-1-9",
			"updateSequenceNumber": 12345678,
			"containerId": "6769746875626d79646f6d61696e636f6d-1",
			"displayName": "Reflected cross-site scripting",
			"description": "**Vulnerability:** Reflected cross-site scripting\n\n**Severity:** Medium\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Open\n\n**Weaknesses:** [CWE-79](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=79), [CWE-116](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=116)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/9) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/9",
			"type": "sast",
			"introducedDate": "2023-08-18T04:33:51Z",
			"lastUpdated": "2023-08-18T04:33:51Z",
			"severity": {
				"level": "medium"
			},
			"identifiers": [
				{
					"displayName": "CWE-79",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=79"
				},
				{
					"displayName": "CWE-116",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=116"
				}
			],
			"status": "open",
			"additionalInfo": {
				"content": "CodeQL"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "c-6769746875626d79646f6d61696e636f6d-1-8",
			"updateSequenceNumber": 12345678,
			"containerId": "6769746875626d79646f6d61696e636f6d-1",
			"displayName": "Hard-coded credentials",
			"description": "**Vulnerability:** Hard-coded credentials\n\n**Severity:** Critical\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Fixed\n\n**Weaknesses:** [CWE-259](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259), [CWE-321](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321), [CWE-798](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/8) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/8",
			"type": "sast",
			"introducedDate": "2023-08-18T04:15:14Z",
			"lastUpdated": "2023-08-18T04:33:51Z",
			"severity": {
				"level": "critical"
			},
			"identifiers": [
				{
					"displayName": "CWE-259",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259"
				},
				{
					"displayName": "CWE-321",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321"
				},
				{
					"displayName": "CWE-798",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798"
				}
			],
			"status": "closed",
			"additionalInfo": {
				"content": "CodeQL"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "c-6769746875626d79646f6d61696e636f6d-1-7",
			"updateSequenceNumber": 12345678,
			"containerId": "6769746875626d79646f6d61696e636f6d-1",
			"displayName": "Database query built from user-controlled sources",
			"description": "**Vulnerability:** Database query built from user-controlled sources\n\n**Severity:** High\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Open\n\n**Weaknesses:** [CWE-89](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=89), [CWE-90](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=90), [CWE-943](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=943)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/7) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/7",
			"type": "sast",
			"introducedDate": "2023-08-09T04:26:41Z",
			"lastUpdated": "2023-08-18T04:33:51Z",
			"severity": {
				"level": "high"
			},
			"identifiers": [
				{
					"displayName": "CWE-89",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=89"
				},
				{
					"displayName": "CWE-90",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=90"
				},
				{
					"displayName": "CWE-943",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=943"
				}
			],
			"status": "open",
			"additionalInfo": {
				"content": "CodeQL"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "c-6769746875626d79646f6d61696e636f6d-1-6",
			"updateSequenceNumber": 12345678,
			"containerId": "6769746875626d79646f6d61696e636f6d-1",
			"displayName": "Reflected cross-site scripting",
			"description": "**Vulnerability:** Reflected cross-site scripting\n\n**Severity:** Medium\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Fixed\n\n**Weaknesses:** [CWE-79](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=79), [CWE-116](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=116)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/6) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/6",
			"type": "sast",
			"introducedDate": "2023-08-09T04:26:41Z",
			"lastUpdated": "2023-08-18T04:13:04Z",
			"severity": {
				"level": "medium"
			},
			"identifiers": [
				{
					"displayName": "CWE-79",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=79"
				},
				{
					"displayName": "CWE-116",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=116"
				}
			],
			"status": "closed",
			"additionalInfo": {
				"content": "CodeQL"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "c-6769746875626d79646f6d61696e636f6d-1-3",
			"updateSequenceNumber": 12345678,
			"containerId": "6769746875626d79646f6d61696e636f6d-1",
			"displayName": "Hard-coded credentials",
			"description": "**Vulnerability:** Hard-coded credentials\n\n**Severity:** Critical\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Fixed\n\n**Weaknesses:** [CWE-259](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259), [CWE-321](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321), [CWE-798](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/3) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/3",
			"type": "sast",
			"introducedDate": "2023-08-03T05:47:19Z",
			"lastUpdated": "2023-08-18T04:13:04Z",
			"severity": {
				"level": "critical"
			},
			"identifiers": [
				{
					"displayName": "CWE-259",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259"
				},
				{
					"displayName": "CWE-321",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321"
				},
				{
					"displayName": "CWE-798",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798"
				}
			],
			"status": "closed",
			"additionalInfo": {
				"content": "CodeQL"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "c-6769746875626d79646f6d61696e636f6d-1-2",
			"updateSequenceNumber": 12345678,
			"containerId": "6769746875626d79646f6d61696e636f6d-1",
			"displayName": "Hard-coded credentials",
			"description": "**Vulnerability:** Hard-coded credentials\n\n**Severity:** Critical\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Fixed\n\n**Weaknesses:** [CWE-259](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259), [CWE-321](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321), [CWE-798](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/2) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/2",
			"type": "sast",
			"introducedDate": "2023-08-01T00:25:22Z",
			"lastUpdated": "2023-08-02T01:39:10Z",
			"severity": {
				"level": "critical"
			},
			"identifiers": [
				{
					"displayName": "CWE-259",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259"
				},
				{
					"displayName": "CWE-321",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321"
				},
				{
					"displayName": "CWE-798",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798"
				}
			],
			"status": "closed",
			"additionalInfo": {
				"content": "CodeQL"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "c-6769746875626d79646f6d61696e636f6d-1-1",
			"updateSequenceNumber": 12345678,
			"containerId": "6769746875626d79646f6d61696e636f6d-1",
			"displayName": "Hard-coded credentials",
			"description": "**Vulnerability:** Hard-coded credentials\n\n**Severity:** Critical\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Fixed\n\n**Weaknesses:** [CWE-259](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259), [CWE-321](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321), [CWE-798](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/1) in GitHub for impact, a recommendation, and a relevant example.",
			"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/1",
			"type": "sast",
			"introducedDate": "2023-07-31T06:37:26Z",
			"lastUpdated": "2023-07-31T06:47:39Z",
			"severity": {
				"level": "critical"
			},
			"identifiers": [
				{
					"displayName": "CWE-259",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259"
				},
				{
					"displayName": "CWE-321",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321"
				},
				{
					"displayName": "CWE-798",
					"url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798"
				}
			],
			"status": "closed",
			"additionalInfo": {
				"content": "CodeQL"
			}
		}
	],
	"properties": {
		"gitHubInstallationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID,
		"workspaceId": subscription.id
	},
	"operationType": "BACKFILL"
});

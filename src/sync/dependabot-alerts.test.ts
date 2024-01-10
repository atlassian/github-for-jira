import { DatabaseStateCreator } from "~/test/utils/database-state-creator";
import dependabotAlerts from "fixtures/api/graphql/dependabot-alerts.json";
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
describe("sync/dependabot-alerts", () => {

	const sentry: Hub = { setUser: jest.fn() } as any;
	const MOCK_SYSTEM_TIMESTAMP_SEC = 12345678;
	let subscription;


	describe("cloud", () => {

		const nockDependabotAlertsRequest = (response: object) =>
			githubNock
				.get("/repos/integrations/test-repo-name/dependabot/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(200, response);

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
				.repoSyncStatePendingForDependabotAlerts()
				.withSecurityPermissionsAccepted()
				.create();
			subscription = builderResult.subscription;
			mockSystemTime(MOCK_SYSTEM_TIMESTAMP_SEC);

		});
		it("should send dependabot alerts to Jira", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			nockDependabotAlertsRequest(dependabotAlerts);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			jiraNock
				.post(
					"/rest/security/1.0/bulk",
					expectedResponseCloudServer(subscription)
				)
				.reply(200);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should not send dependabot alerts to Jira if FF is disabled", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(false);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			expect(mockBackfillQueueSendMessage).not.toBeCalled();
		});

		it("should not call Jira if not dependabot alerts are found", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			nockDependabotAlertsRequest({
				"data": []
			});
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should handle dependabot scanning disabled error", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/dependabot/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(403, { message: "Dependabot alerts are disabled for this repository" });
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should handle archived repo error", async () => {
			when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			githubNock
				.get("/repos/integrations/test-repo-name/dependabot/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(403, { message: "Dependabot alerts are not available for archived repositories" });
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
				.get("/repos/integrations/test-repo-name/dependabot/alerts?per_page=20&page=1&sort=created&direction=desc")
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
				.get("/repos/integrations/test-repo-name/dependabot/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(451);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			// No Jira Nock

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});
	});

	describe("server", () => {

		const nockDependabotAlertsRequest = (response: object) =>
			gheNock
				.get("/api/v3/repos/integrations/test-repo-name/dependabot/alerts?per_page=20&page=1&sort=created&direction=desc")
				.reply(200, response);

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
				.repoSyncStatePendingForDependabotAlerts()
				.withSecurityPermissionsAccepted()
				.create();

			subscription = builderResult.subscription;
			mockSystemTime(MOCK_SYSTEM_TIMESTAMP_SEC);

			gitHubServerApp = builderResult.gitHubServerApp!;
		});

		it("should send dependabot alerts to Jira", async () => {
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
			nockDependabotAlertsRequest(dependabotAlerts);
			jiraNock
				.post(
					"/rest/security/1.0/bulk",
					expectedResponseGHEServer(subscription)
				)
				.reply(200);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should not call Jira if not dependabot alerts are found", async () => {
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
			nockDependabotAlertsRequest({
				"data": []
			});
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
			"id": "d-1-1",
			"updateSequenceNumber": 12345678,
			"containerId": "1",
			"displayName": "semver vulnerable to Regular Expression Denial of Service",
			"description": "**Vulnerability:** semver vulnerable to Regular Expression Denial of Service\n\n**Impact:** Versions of the package semver before 7.5.2 on the 7.x branch, before 6.3.1 on the 6.x branch, and all other versions before 5.7.2 are vulnerable to Regular Expression Denial of Service (ReDoS) via the function new Range, when untrusted user data is provided as a range.\n\n**Severity:**  - undefined\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**State:** Open\n\n**Patched version:** undefined\n\n**Identifiers:**\n\n- [GHSA-c2qf-rxjj-qqgw](https://github.com/advisories/GHSA-c2qf-rxjj-qqgw)\n- [CVE-2022-25883](https://nvd.nist.gov/vuln/detail/CVE-2022-25883)\n\nVisit the vulnerability’s [dependabot alert page](undefined) in GitHub to learn more about and see remediation options.",
			"type": "sca",
			"introducedDate": "2023-07-13T06:24:50Z",
			"lastUpdated": "2023-07-13T06:24:50Z",
			"severity": {
				"level": "medium"
			},
			"identifiers": [
				{
					"displayName": "GHSA-c2qf-rxjj-qqgw",
					"url": "https://github.com/advisories/GHSA-c2qf-rxjj-qqgw"
				},
				{
					"displayName": "CVE-2022-25883",
					"url": "https://nvd.nist.gov/vuln/detail/CVE-2022-25883"
				}
			],
			"status": "open",
			"additionalInfo": {
				"content": "yarn.lock"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "d-1-2",
			"updateSequenceNumber": 12345678,
			"containerId": "1",
			"displayName": "semver vulnerable to Regular Expression Denial of Service",
			"description": "**Vulnerability:** semver vulnerable to Regular Expression Denial of Service\n\n**Impact:** Versions of the package semver before 7.5.2 on the 7.x branch, before 6.3.1 on the 6.x branch, and all other versions before 5.7.2 are vulnerable to Regular Expression Denial of Service (ReDoS) via the function new Range, when untrusted user data is provided as a range.\n\n**Severity:**  - undefined\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**State:** Open\n\n**Patched version:** undefined\n\n**Identifiers:**\n\n- [GHSA-c2qf-rxjj-qqgw](https://github.com/advisories/GHSA-c2qf-rxjj-qqgw)\n- [CVE-2022-25883](https://nvd.nist.gov/vuln/detail/CVE-2022-25883)\n\nVisit the vulnerability’s [dependabot alert page](undefined) in GitHub to learn more about and see remediation options.",
			"type": "sca",
			"introducedDate": "2023-07-13T06:24:50Z",
			"lastUpdated": "2023-07-13T06:24:50Z",
			"severity": {
				"level": "low"
			},
			"identifiers": [
				{
					"displayName": "GHSA-c2qf-rxjj-qqgw",
					"url": "https://github.com/advisories/GHSA-c2qf-rxjj-qqgw"
				},
				{
					"displayName": "CVE-2022-25883",
					"url": "https://nvd.nist.gov/vuln/detail/CVE-2022-25883"
				}
			],
			"status": "open",
			"additionalInfo": {
				"content": "yarn.lock"
			}
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
			"id": "d-6769746875626d79646f6d61696e636f6d-1-1",
			"updateSequenceNumber": 12345678,
			"containerId": "6769746875626d79646f6d61696e636f6d-1",
			"displayName": "semver vulnerable to Regular Expression Denial of Service",
			"description": "**Vulnerability:** semver vulnerable to Regular Expression Denial of Service\n\n**Impact:** Versions of the package semver before 7.5.2 on the 7.x branch, before 6.3.1 on the 6.x branch, and all other versions before 5.7.2 are vulnerable to Regular Expression Denial of Service (ReDoS) via the function new Range, when untrusted user data is provided as a range.\n\n**Severity:**  - undefined\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**State:** Open\n\n**Patched version:** undefined\n\n**Identifiers:**\n\n- [GHSA-c2qf-rxjj-qqgw](https://github.com/advisories/GHSA-c2qf-rxjj-qqgw)\n- [CVE-2022-25883](https://nvd.nist.gov/vuln/detail/CVE-2022-25883)\n\nVisit the vulnerability’s [dependabot alert page](undefined) in GitHub to learn more about and see remediation options.",
			"type": "sca",
			"introducedDate": "2023-07-13T06:24:50Z",
			"lastUpdated": "2023-07-13T06:24:50Z",
			"severity": {
				"level": "medium"
			},
			"identifiers": [
				{
					"displayName": "GHSA-c2qf-rxjj-qqgw",
					"url": "https://github.com/advisories/GHSA-c2qf-rxjj-qqgw"
				},
				{
					"displayName": "CVE-2022-25883",
					"url": "https://nvd.nist.gov/vuln/detail/CVE-2022-25883"
				}
			],
			"status": "open",
			"additionalInfo": {
				"content": "yarn.lock"
			}
		},
		{
			"schemaVersion": "1.0",
			"id": "d-6769746875626d79646f6d61696e636f6d-1-2",
			"updateSequenceNumber": 12345678,
			"containerId": "6769746875626d79646f6d61696e636f6d-1",
			"displayName": "semver vulnerable to Regular Expression Denial of Service",
			"description": "**Vulnerability:** semver vulnerable to Regular Expression Denial of Service\n\n**Impact:** Versions of the package semver before 7.5.2 on the 7.x branch, before 6.3.1 on the 6.x branch, and all other versions before 5.7.2 are vulnerable to Regular Expression Denial of Service (ReDoS) via the function new Range, when untrusted user data is provided as a range.\n\n**Severity:**  - undefined\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**State:** Open\n\n**Patched version:** undefined\n\n**Identifiers:**\n\n- [GHSA-c2qf-rxjj-qqgw](https://github.com/advisories/GHSA-c2qf-rxjj-qqgw)\n- [CVE-2022-25883](https://nvd.nist.gov/vuln/detail/CVE-2022-25883)\n\nVisit the vulnerability’s [dependabot alert page](undefined) in GitHub to learn more about and see remediation options.",
			"type": "sca",
			"introducedDate": "2023-07-13T06:24:50Z",
			"lastUpdated": "2023-07-13T06:24:50Z",
			"severity": {
				"level": "low"
			},
			"identifiers": [
				{
					"displayName": "GHSA-c2qf-rxjj-qqgw",
					"url": "https://github.com/advisories/GHSA-c2qf-rxjj-qqgw"
				},
				{
					"displayName": "CVE-2022-25883",
					"url": "https://nvd.nist.gov/vuln/detail/CVE-2022-25883"
				}
			],
			"status": "open",
			"additionalInfo": {
				"content": "yarn.lock"
			}
		}
	],
	"properties": {
		"gitHubInstallationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID,
		"workspaceId": subscription.id
	},
	"operationType": "BACKFILL"
});

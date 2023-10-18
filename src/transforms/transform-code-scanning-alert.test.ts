import {
	transformCodeScanningAlert,
	transformCodeScanningAlertToJiraSecurity
} from "./transform-code-scanning-alert";
import codeScanningPayload from "./../../test/fixtures/api/code-scanning-alert.json";
import codeScanningCreatedPayload from "./../../test/fixtures/api/code-scanning-alert-created.json";
import codeScanningCreatedPrPayload from "./../../test/fixtures/api/code-scanning-alert-created-pr.json";
import codeScanningFixedPayload from "./../../test/fixtures/api/code-scanning-alert-fixed.json";
import codeScanningClosedByUserPayload from "./../../test/fixtures/api/code-scanning-alert-closed-by-user.json";
import codeScanningCreatedJsXssPayload from "./../../test/fixtures/api/code-scanning-alert-created-js-xss.json";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { GitHubAppConfig } from "~/src/sqs/sqs.types";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { JiraVulnerabilityStatusEnum } from "interfaces/jira";
import Logger from "bunyan";

const buildContext = (
	payload,
	gitHubAppConfig?: GitHubAppConfig
): WebhookContext => {
	const logger = { info: jest.fn(), warn: jest.fn() } as unknown as Logger;
	logger.child = jest.fn(() => logger);
	return new WebhookContext({
		id: "hi",
		name: "hi",
		payload: payload,
		gitHubAppConfig: gitHubAppConfig || {
			gitHubAppId: undefined,
			appId: 1,
			clientId: "abc",
			gitHubBaseUrl: "https://github.com",
			gitHubApiUrl: "https://api.github.com",
			uuid: undefined
		},
		log: logger
	});

};

describe("code_scanning_alert transform", () => {
	beforeEach(() => {
		Date.now = jest.fn(() => 12345678);
	});
	const gitHubInstallationId = 1234;
	const jiraHost = "testHost";

	describe("remote links", () => {
		it("code_scanning_alert is transformed into a remote link for Cloud", async () => {
			const remoteLinks = await transformCodeScanningAlert(
				buildContext(codeScanningPayload),
				gitHubInstallationId,
				jiraHost
			);
			expect(remoteLinks).toMatchObject({
				remoteLinks: [
					{
						schemaVersion: "1.0",
						id: "403470608-272",
						updateSequenceNumber: 12345678,
						displayName: "Alert #272",
						description: "Reflected cross-site scripting",
						url: "https://github.com/TerryAg/github-jira-test/security/code-scanning/272",
						type: "security",
						status: {
							appearance: "removed",
							label: "open"
						},
						lastUpdated: "2021-09-06T06:00:00Z",
						associations: [
							{
								associationType: "issueKeys",
								values: ["GH-9"]
							}
						]
					}
				]
			});
		});

		it("code_scanning_alert is transformed into a remote link for server", async () => {
			const builderOutput = await new DatabaseStateCreator()
				.forServer()
				.create();
			const gitHubServerApp = builderOutput.gitHubServerApp!;

			const remoteLinks = await transformCodeScanningAlert(
				buildContext(codeScanningPayload, {
					gitHubAppId: gitHubServerApp.id,
					appId: gitHubServerApp.appId,
					clientId: gitHubServerApp.gitHubClientId,
					gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
					gitHubApiUrl: gitHubServerApp.gitHubBaseUrl + "/api",
					uuid: gitHubServerApp.uuid
				}),
				gitHubInstallationId,
				jiraHost
			);

			expect(remoteLinks).toMatchObject({
				remoteLinks: [
					{
						schemaVersion: "1.0",
						id: "6769746875626d79646f6d61696e636f6d-403470608-272",
						updateSequenceNumber: 12345678,
						displayName: "Alert #272",
						description: "Reflected cross-site scripting",
						url: "https://github.com/TerryAg/github-jira-test/security/code-scanning/272",
						type: "security",
						status: {
							appearance: "removed",
							label: "open"
						},
						lastUpdated: "2021-09-06T06:00:00Z",
						associations: [
							{
								associationType: "issueKeys",
								values: ["GH-9"]
							}
						]
					}
				]
			});
		});

		it("manual code_scanning_alert maps to multiple Jira issue keys", async () => {
			const payload = { ...codeScanningPayload, action: "closed_by_user" };
			const remoteLinks = await transformCodeScanningAlert(
				buildContext(payload),
				gitHubInstallationId,
				jiraHost
			);
			expect(remoteLinks?.remoteLinks[0].associations[0].values).toEqual([
				"GH-9",
				"GH-10",
				"GH-11"
			]);
		});

		it("code_scanning_alert truncates to a shorter description if too long", async () => {
			const payload = {
				...codeScanningPayload,
				alert: {
					...codeScanningPayload.alert,
					rule: {
						...codeScanningPayload.alert.rule,
						description: "A".repeat(300)
					}
				}
			};
			const remoteLinks = await transformCodeScanningAlert(
				buildContext(payload),
				gitHubInstallationId,
				jiraHost
			);
			expect(remoteLinks?.remoteLinks[0].description).toHaveLength(255);
		});

		it("code_scanning_alert with pr reference queries Pull Request title - GH Client", async () => {
			const payload = { ...codeScanningPayload, ref: "refs/pull/8/merge" };
			const context = buildContext(payload);

			githubUserTokenNock(gitHubInstallationId);
			githubNock.get(`/repos/TerryAg/github-jira-test/pulls/8`).reply(200, {
				title: "GH-10"
			});

			const remoteLinks = await transformCodeScanningAlert(
				context,
				gitHubInstallationId,
				jiraHost
			);
			expect(remoteLinks?.remoteLinks[0].associations[0].values[0]).toEqual(
				"GH-10"
			);
		});
	});

	describe("security vulnerabilities", () => {
		it("transform code scanning alert to jira security payload", async () => {
			const result = await transformCodeScanningAlertToJiraSecurity(
				buildContext(codeScanningCreatedPayload),
				gitHubInstallationId,
				jiraHost
			);
			expect(result?.vulnerabilities[0]).toMatchObject(
				{
					"additionalInfo": {
						"content": "CodeQL"
					},
					"containerId": "119484675",
					"displayName": "Hard-coded credentials",
					"description": "**Vulnerability:** Hard-coded credentials\n\n**Severity:** Critical\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** Open\n\n**Weaknesses:** [CWE-259](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=259), [CWE-321](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=321), [CWE-798](https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=798)\n\nVisit the vulnerability’s [code scanning alert page](https://github.com/auzwang/sequelize-playground/security/code-scanning/2) in GitHub for impact, a recommendation, and a relevant example.",
					"id": "c-119484675-2",
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
					"introducedDate": "2023-08-01T00:25:22Z",
					"lastUpdated": "2023-08-01T00:25:22Z",
					"schemaVersion": "1.0",
					"severity": {
						"level": "critical"
					},
					"status": "open",
					"type": "sast",
					"updateSequenceNumber": 12345678,
					"url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/2"
				}
			);
		});

		it.each([
			["open", JiraVulnerabilityStatusEnum.OPEN],
			["fixed", JiraVulnerabilityStatusEnum.CLOSED],
			["dismissed", JiraVulnerabilityStatusEnum.IGNORED],
			["auto_dismissed", JiraVulnerabilityStatusEnum.IGNORED],
			["unmapped_state", JiraVulnerabilityStatusEnum.UNKNOWN]
		])(
			"transform code scanning alert state %s to security vulnerability status %s",
			async (state, expectedStatus) => {
				const payload = {
					...codeScanningCreatedPayload,
					alert: { ...codeScanningCreatedPayload.alert, state }
				};
				const context = buildContext(payload);
				const result = await transformCodeScanningAlertToJiraSecurity(
					context,
					gitHubInstallationId,
					jiraHost
				);
				expect(result?.vulnerabilities[0].status).toEqual(expectedStatus);
			}
		);

		it("map fixed code scanning alert fixed_at to jira security lastUpdated", async () => {
			const result = await transformCodeScanningAlertToJiraSecurity(
				buildContext(codeScanningFixedPayload),
				gitHubInstallationId,
				jiraHost
			);
			expect(result?.vulnerabilities[0].lastUpdated).toBe(
				codeScanningFixedPayload.alert.fixed_at
			);
		});

		it("map closed by user code scanning alert dismissed_at to jira security lastUpdated", async () => {
			const result = await transformCodeScanningAlertToJiraSecurity(
				buildContext(codeScanningClosedByUserPayload),
				gitHubInstallationId,
				jiraHost
			);
			expect(result?.vulnerabilities[0].lastUpdated).toBe(
				codeScanningClosedByUserPayload.alert.dismissed_at
			);
		});

		it("skip transforming code scanning alerts created from pull requests", async () => {
			const result = await transformCodeScanningAlertToJiraSecurity(
				buildContext(codeScanningCreatedPrPayload),
				gitHubInstallationId,
				jiraHost
			);
			expect(result).toBe(null);
		});

		it("should log unmapped state", async () => {
			const payload = {
				...codeScanningCreatedPayload,
				alert: { ...codeScanningCreatedPayload.alert, state: "unmapped_state" }
			};
			const context = buildContext(payload);
			await transformCodeScanningAlertToJiraSecurity(
				context,
				gitHubInstallationId,
				jiraHost
			);
			expect(context.log.info).toHaveBeenCalledWith(
				"Received unmapped state from code_scanning_alert webhook: unmapped_state"
			);
		});

		it("should log unmapped severity", async () => {
			const payload = {
				...codeScanningCreatedPayload,
				alert: {
					...codeScanningCreatedPayload.alert,
					rule: {
						...codeScanningCreatedPayload.alert.rule,
						security_severity_level: "unmapped_severity"
					}
				}
			};
			const context = buildContext(payload);
			await transformCodeScanningAlertToJiraSecurity(
				context,
				gitHubInstallationId,
				jiraHost
			);
			expect(context.log.info).toHaveBeenCalledWith(
				"Received unmapped severity from code_scanning_alert webhook: unmapped_severity"
			);
		});

		it("set identifiers when alert rule tags contains CWEs", async () => {
			const payload = codeScanningCreatedJsXssPayload;
			const context = buildContext(payload);
			const result = await transformCodeScanningAlertToJiraSecurity(
				context,
				gitHubInstallationId,
				jiraHost
			);
			expect(result?.vulnerabilities[0].identifiers).toMatchInlineSnapshot(`
			Array [
			  Object {
			    "displayName": "CWE-79",
			    "url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=79",
			  },
			  Object {
			    "displayName": "CWE-116",
			    "url": "https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=116",
			  },
			]
		`);
		});

		it("omit identifiers when alert rule tags is null", async () => {
			const payload = {
				...codeScanningCreatedJsXssPayload,
				alert: {
					...codeScanningCreatedJsXssPayload.alert,
					rule: {
						...codeScanningCreatedJsXssPayload.alert.rule,
						tags: null
					}
				}
			};
			const context = buildContext(payload);
			const result = await transformCodeScanningAlertToJiraSecurity(
				context,
				gitHubInstallationId,
				jiraHost
			);
			expect(result?.vulnerabilities[0].identifiers).toBe(undefined);
		});

		it("omit identifiers when alert rule tags is empty", async () => {
			const payload = {
				...codeScanningCreatedJsXssPayload,
				alert: {
					...codeScanningCreatedJsXssPayload.alert,
					rule: {
						...codeScanningCreatedJsXssPayload.alert.rule,
						tags: []
					}
				}
			};
			const context = buildContext(payload);
			const result = await transformCodeScanningAlertToJiraSecurity(
				context,
				gitHubInstallationId,
				jiraHost
			);
			expect(result?.vulnerabilities[0].identifiers).toBe(undefined);
		});

		it("omit identifiers when alert rule tags have no CWEs", async () => {
			const payload = {
				...codeScanningCreatedJsXssPayload,
				alert: {
					...codeScanningCreatedJsXssPayload.alert,
					rule: {
						...codeScanningCreatedJsXssPayload.alert.rule,
						tags: ["security"]
					}
				}
			};
			const context = buildContext(payload);
			const result = await transformCodeScanningAlertToJiraSecurity(
				context,
				gitHubInstallationId,
				jiraHost
			);
			expect(result?.vulnerabilities[0].identifiers).toBe(undefined);
		});
	});
});

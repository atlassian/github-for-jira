import { dependabotAlertWebhookHandler } from "./dependabot-alert";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { getLogger } from "config/logger";
import { envVars } from "config/env";
import {
	GITHUB_CLOUD_API_BASEURL,
	GITHUB_CLOUD_BASEURL
} from "~/src/github/client/github-client-constants";
import {
	JiraVulnerabilityBulkSubmitData,
	JiraVulnerabilitySeverityEnum,
	JiraVulnerabilityStatusEnum
} from "../interfaces/jira";
import { JiraClient } from "../jira/client/jira-client";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { BooleanFlags, booleanFlag } from "../config/feature-flags";
import { when } from "jest-when";

const GITHUB_INSTALLATION_ID = 1234;
const GHES_GITHUB_APP_ID = 111;
const GHES_GITHUB_UUID = "xxx-xxx-xxx-xxx";
const GHES_GITHUB_APP_APP_ID = 1;
const GHES_GITHUB_APP_CLIENT_ID = "client-id";
const ID_1 = "1";
const DEPENDABOT_ALERT = "dependabot_alert";
const TEST_LOG = "test";
const CREATED = "created";
const OPEN = "open";
const HIGH = JiraVulnerabilitySeverityEnum.HIGH;
const PATH_TO_MANIFEST = "path/to/manifest";
const SAMPLE_SECURITY_ADVISORY_SUMMARY = "Sample security advisory summary";
const SAMPLE_SECURITY_ADVISORY_DESCRIPTION =
	"Sample security advisory description";
const SAMPLE_SECURITY_URL =
	"https://github.com/user/repo/security/advisories/123";
const JIRA_VULNERABILITY_STATUS_ENUM_OPEN = JiraVulnerabilityStatusEnum.OPEN;
const SAMPLE_SECURITY_CREATED_DATE = "2022-01-01T00:00:00Z";
const SAMPLE_SECURITY_UPDATED_DATE = "2022-01-02T00:00:00Z";
const WEBHOOK_RECIEVED_ISO = 1688951387;
jest.mock("utils/webhook-utils");
jest.mock("config/feature-flags");

describe("DependabotAlertWebhookHandler", () => {
	const RealDate = Date.now;

	beforeAll(() => {
		global.Date.now = jest.fn(() => new Date("2019-04-07T10:20:30Z").getTime());
	});

	afterAll(() => {
		global.Date.now = RealDate;
	});
	let jiraClient: JiraClient;
	beforeEach(() => {
		jiraClient = {
			baseURL: jiraHost,
			security: { submitVulnerabilities: jest.fn(() => ({ status: 200 })) }
		} as unknown as JiraClient;
		when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
	});
	it("should call jira client with transformed vulnerability", async () => {
		await dependabotAlertWebhookHandler(
			getWebhookContext({ cloud: true }),
			jiraClient,
			undefined,
			GITHUB_INSTALLATION_ID
		);
		expect(jiraClient.security.submitVulnerabilities).toBeCalledWith(
			getVulnerabilityPayload()
		);
	});
	it("should call the webhook logger", async () => {
		await dependabotAlertWebhookHandler(
			getWebhookContext({ cloud: true }),
			jiraClient,
			undefined,
			GITHUB_INSTALLATION_ID
		);
		expect(emitWebhookProcessedMetrics).toBeCalledWith(
			WEBHOOK_RECIEVED_ISO,
			"dependabot_alert",
			jiraHost,
			expect.any(Object),
			200,
			undefined
		);
	});

	it("should not call jira client with transformed vulnerability if FF is OFF", async () => {
		when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(false);
		await dependabotAlertWebhookHandler(
			getWebhookContext({ cloud: true }),
			jiraClient,
			undefined,
			GITHUB_INSTALLATION_ID
		);
		expect(jiraClient.security.submitVulnerabilities).toBeCalledTimes(0);
	});

	const getWebhookContext = <T>({ cloud }: { cloud: boolean }): WebhookContext<T> => {
		return {
			id: ID_1,
			name: DEPENDABOT_ALERT,
			log: getLogger(TEST_LOG),
			payload: {
				action: CREATED,
				alert: {
					number: 123,
					security_advisory: {
						summary: SAMPLE_SECURITY_ADVISORY_SUMMARY,
						description: SAMPLE_SECURITY_ADVISORY_DESCRIPTION,
						severity: HIGH,
						cvss: {
							score: "7.4"
						},
						identifiers: [{
							value: "GHSA-jf85-cpcp-j695",
							type: "GHSA"
						}, {
							value: "CVE-2019-10744",
							type: "CVE"
						}],
						references: [{
							url: "https://github.com/lodash/lodash/pull/4336"
						},
						{
							url: "https://nvd.nist.gov/vuln/detail/CVE-2019-10744"
						},
						{
							url: "https://snyk.io/vuln/SNYK-JS-LODASH-450202"
						},
						{
							url: "https://www.npmjs.com/advisories/1065"
						},
						{
							url: "https://access.redhat.com/errata/RHSA-2019:3024"
						},
						{
							url: "https://security.netapp.com/advisory/ntap-20191004-0005/"
						},
						{
							url: "https://support.f5.com/csp/article/K47105354?utm_source=f5support&amp;utm_medium=RSS"
						},
						{
							url: "https://www.oracle.com/security-alerts/cpujan2021.html"
						},
						{
							url: "https://www.oracle.com/security-alerts/cpuoct2020.html"
						},
						{
							url: "https://github.com/advisories/GHSA-jf85-cpcp-j695"
						}
						]
					},
					html_url: SAMPLE_SECURITY_URL,
					created_at: SAMPLE_SECURITY_CREATED_DATE,
					updated_at: SAMPLE_SECURITY_UPDATED_DATE,
					security_vulnerability: {
						severity: HIGH,
						first_patched_version: {
							identifier: "4.17.12"
						}
					},
					dependency: {
						manifest_path: PATH_TO_MANIFEST
					},
					state: OPEN
				},
				repository: {
					id: 456
				},
				ref: "TEST-1"
			} as unknown as T,
			gitHubAppConfig: cloud
				? {
					uuid: undefined,
					gitHubAppId: undefined,
					appId: parseInt(envVars.APP_ID),
					clientId: envVars.GITHUB_CLIENT_ID,
					gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
					gitHubApiUrl: GITHUB_CLOUD_API_BASEURL
				}
				: {
					uuid: GHES_GITHUB_UUID,
					gitHubAppId: GHES_GITHUB_APP_ID,
					appId: GHES_GITHUB_APP_APP_ID,
					clientId: GHES_GITHUB_APP_CLIENT_ID,
					gitHubBaseUrl: gheUrl,
					gitHubApiUrl: gheUrl
				},
			webhookReceived: WEBHOOK_RECIEVED_ISO
		};
	};
	const getVulnerabilityPayload = (): JiraVulnerabilityBulkSubmitData => {
		return {
			vulnerabilities: [
				{
					schemaVersion: "1.0",
					id: "d-456-123",
					updateSequenceNumber: Date.now(),
					containerId: "456",
					displayName: SAMPLE_SECURITY_ADVISORY_SUMMARY,
					description: "**Vulnerability:** Sample security advisory summary\n\n**Impact:** Sample security advisory description\n\n**Severity:** High - 7.4\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**State:** Open\n\n**Patched version:** 4.17.12\n\n**Identifiers:**\n\n- [GHSA-jf85-cpcp-j695](https://github.com/advisories/GHSA-jf85-cpcp-j695)\n- [CVE-2019-10744](https://nvd.nist.gov/vuln/detail/CVE-2019-10744)\n\nVisit the vulnerability’s [dependabot alert page](https://github.com/user/repo/security/advisories/123) in GitHub to learn more about and see remediation options.",
					url: SAMPLE_SECURITY_URL,
					type: "sca",
					introducedDate: SAMPLE_SECURITY_CREATED_DATE,
					lastUpdated: SAMPLE_SECURITY_UPDATED_DATE,
					severity: {
						level: HIGH
					},
					identifiers: [{
						"displayName": "GHSA-jf85-cpcp-j695",
						"url": "https://github.com/advisories/GHSA-jf85-cpcp-j695"
					}, {
						"displayName": "CVE-2019-10744",
						"url": "https://nvd.nist.gov/vuln/detail/CVE-2019-10744"
					}],
					status: JIRA_VULNERABILITY_STATUS_ENUM_OPEN,
					additionalInfo: {
						content: PATH_TO_MANIFEST
					}
				}
			]
		};
	};
});

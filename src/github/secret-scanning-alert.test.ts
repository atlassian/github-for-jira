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
import { secretScanningAlertWebhookHandler } from "./secret-scanning-alert";
import { emitWebhookProcessedMetrics } from "../util/webhook-utils";
import { when } from "jest-when";
import { BooleanFlags, booleanFlag } from "../config/feature-flags";

const GITHUB_INSTALLATION_ID = 1234;
const GHES_GITHUB_APP_ID = 111;
const GHES_GITHUB_UUID = "xxx-xxx-xxx-xxx";
const GHES_GITHUB_APP_APP_ID = 1;
const GHES_GITHUB_APP_CLIENT_ID = "client-id";
const ID_1 = "1";
const SECRET_SCANNING_ALERT = "secret_scanning_alert";
const TEST_LOG = "test";
const CREATED = "created";
const CRITICAL = JiraVulnerabilitySeverityEnum.CRITICAL;

const SAMPLE_SECURITY_URL =
	"https://github.com/user/repo/security/advisories/123";
const JIRA_VULNERABILITY_STATUS_ENUM_OPEN = JiraVulnerabilityStatusEnum.OPEN;
const SAMPLE_SECURITY_CREATED_DATE = "2022-01-01T00:00:00Z";
const SAMPLE_SECURITY_UPDATED_DATE = "2022-01-02T00:00:00Z";
const WEBHOOK_RECIEVED_ISO = 1688951387;
jest.mock("utils/webhook-utils");
jest.mock("config/feature-flags");

describe("SecretScanningAlertWebhookHandler", () => {
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
			security: { submitVulnerabilities: jest.fn(() =>({ status: 200 })) }
		} as unknown as JiraClient;
		when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);
	});
	it("should call jira client with transformed vulnerability", async () => {
		await secretScanningAlertWebhookHandler(
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
		await secretScanningAlertWebhookHandler(
			getWebhookContext({ cloud: true }),
			jiraClient,
			undefined,
			GITHUB_INSTALLATION_ID
		);
		expect(emitWebhookProcessedMetrics).toBeCalledWith(
			WEBHOOK_RECIEVED_ISO,
			"secret_scanning_alert",
			jiraHost,
			expect.any(Object),
			200,
			undefined
		);
	});
	it("should not call jira client with transformed vulnerability if FF is OFF", async () => {
		when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(false);
		await secretScanningAlertWebhookHandler(
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
			name: SECRET_SCANNING_ALERT,
			log: getLogger(TEST_LOG),
			action: CREATED,
			payload: {
				alert: {
					number: 123,
					html_url: SAMPLE_SECURITY_URL,
					created_at: SAMPLE_SECURITY_CREATED_DATE,
					updated_at: SAMPLE_SECURITY_UPDATED_DATE,
					secret_type: "personal_access_token"
				},
				repository: {
					id: 456
				}
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
					displayName: "personal_access_token secret exposed",
					description: "Secret scanning alert",
					url: SAMPLE_SECURITY_URL,
					type: "sast",
					introducedDate: SAMPLE_SECURITY_CREATED_DATE,
					lastUpdated: SAMPLE_SECURITY_UPDATED_DATE,
					severity: {
						level: CRITICAL
					},
					identifiers: [{
						"displayName": "personal_access_token",
						"url":SAMPLE_SECURITY_URL
					}],
					status: JIRA_VULNERABILITY_STATUS_ENUM_OPEN,
					additionalInfo: {
						content: "personal_access_token"
					}
				}
			]
		};
	};
});

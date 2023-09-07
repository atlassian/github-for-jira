import { WebhookContext } from "routes/github/webhook/webhook-context";
import { getLogger } from "config/logger";
import { codeScanningAlertWebhookHandler } from "./code-scanning-alert";
import {
	transformCodeScanningAlert,
	transformCodeScanningAlertToJiraSecurity
} from "../transforms/transform-code-scanning-alert";
import codeScanningAlertCreated from "test/fixtures/api/code-scanning-alert-created.json";
import { mocked } from "jest-mock";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import Logger from "bunyan";
import { booleanFlag } from "config/feature-flags";
import { DeploymentsResult, JiraClient } from "../jira/client/jira-client";
import { AxiosResponse } from "axios";
import { JiraIssue, JiraSubmitOptions, JiraBuildBulkSubmitData, JiraDeploymentBulkSubmitData } from "../interfaces/jira";
import { TransformedRepositoryId } from "../transforms/transform-repository-id";

jest.mock("config/feature-flags");
jest.mock("utils/webhook-utils");
jest.mock("../transforms/transform-code-scanning-alert");
const mockBooleanFlag = mocked(booleanFlag);
const mockEmitWebhookProcessedMetrics = mocked(emitWebhookProcessedMetrics);
const mockTransformCodeScanningAlert = mocked(transformCodeScanningAlert);
const mockTransformCodeScanningAlertToJiraSecurity = mocked(
	transformCodeScanningAlertToJiraSecurity
);

const GITHUB_INSTALLATION_ID = 1234;
const TEST_LOG = "test";
const ALERT_NAME =  "code_scanning_alert";
const WEBHOOK_RECEIVED =  1691122930644;
const JIRA_BASE_URL = "https://test.atlassian.net/jira";
const getWebhookContext = <T>(): WebhookContext<T> => {
	return {
		id: "e7419700-3001-11ee-97c2-cb68b59674fc",
		name: ALERT_NAME,
		payload: codeScanningAlertCreated as unknown as T,
		log: getLogger(TEST_LOG),
		action: "created",
		gitHubAppConfig: {
			uuid: undefined,
			gitHubAppId: undefined,
			appId: 366241,
			clientId: "Iv1.8a8d1e6f090af278",
			gitHubBaseUrl: "https://github.com",
			gitHubApiUrl: "https://api.github.com"
		},
		webhookReceived: WEBHOOK_RECEIVED
	};
};

describe("Code Scanning Alert Webhook Handler", () => {
	beforeEach(() => {
		jest.resetAllMocks();
		mockBooleanFlag.mockResolvedValue(true);
	});

	const mockJiraRemoteLinkSubmit = jest.fn();
	const mockJiraSecuritySubmit = jest.fn();
	const jiraClient: JiraClient = {
		baseURL: JIRA_BASE_URL,
		remoteLink: { submit: mockJiraRemoteLinkSubmit },
		security: { submitVulnerabilities: mockJiraSecuritySubmit },
		issues: {
			get: function (_issueId: string, _query?: { fields: string; } | undefined): Promise<AxiosResponse<JiraIssue, any>> {
				throw new Error("Function not implemented.");
			},
			getAll: function (_issueIds: string[], _query?: { fields: string; } | undefined): Promise<JiraIssue[]> {
				throw new Error("Function not implemented.");
			},
			parse: function (_text: string): string[] | undefined {
				throw new Error("Function not implemented.");
			},
			comments: {
				list: function (_issue_id: string) {
					throw new Error("Function not implemented.");
				},
				addForIssue: function (_issue_id: string, _payload: any) {
					throw new Error("Function not implemented.");
				},
				updateForIssue: function (_issue_id: string, _comment_id: string, _payload: any) {
					throw new Error("Function not implemented.");
				},
				deleteForIssue: function (_issue_id: string, _comment_id: string) {
					throw new Error("Function not implemented.");
				}
			},
			transitions: {
				getForIssue: function (_issue_id: string) {
					throw new Error("Function not implemented.");
				},
				updateForIssue: function (_issue_id: string, _transition_id: string) {
					throw new Error("Function not implemented.");
				}
			},
			worklogs: {
				addForIssue: function (_issue_id: string, _payload: any) {
					throw new Error("Function not implemented.");
				}
			}
		},
		devinfo: {
			branch: {
				delete: function (_transformedRepositoryId: TransformedRepositoryId, _branchRef: string) {
					throw new Error("Function not implemented.");
				}
			},
			installation: {
				delete: function (_gitHubInstallationId: string | number): Promise<any[]> {
					throw new Error("Function not implemented.");
				}
			},
			pullRequest: {
				delete: function (_transformedRepositoryId: TransformedRepositoryId, _pullRequestId: string) {
					throw new Error("Function not implemented.");
				}
			},
			repository: {
				delete: function (_epositoryId: number, _gitHubBaseUrl?: string | undefined): Promise<any[]> {
					throw new Error("Function not implemented.");
				},
				update: function (_data: any, _options?: JiraSubmitOptions | undefined) {
					throw new Error("Function not implemented.");
				}
			}
		},
		workflow: {
			submit: function (_data: JiraBuildBulkSubmitData, _repositoryId: number, _options?: JiraSubmitOptions | undefined): Promise<any> {
				throw new Error("Function not implemented.");
			}
		},
		deployment: {
			submit: function (_data: JiraDeploymentBulkSubmitData, _repositoryId: number, _options?: JiraSubmitOptions | undefined): Promise<DeploymentsResult> {
				throw new Error("Function not implemented.");
			}
		}
	};

	it("transform and submit remote link to jira", async () => {
		const jiraPayload = { remoteLinks: [] };
		mockTransformCodeScanningAlert.mockResolvedValueOnce(jiraPayload);
		mockJiraRemoteLinkSubmit.mockResolvedValueOnce({ status: 200 });
		await codeScanningAlertWebhookHandler(
			getWebhookContext(),
			jiraClient,
			undefined,
			GITHUB_INSTALLATION_ID
		);
		expect(jiraClient.remoteLink.submit).toHaveBeenCalledWith(jiraPayload);
		expect(mockEmitWebhookProcessedMetrics).toHaveBeenCalledWith(WEBHOOK_RECEIVED, ALERT_NAME, JIRA_BASE_URL, expect.any(Logger), 200, undefined);
		expect(mockJiraSecuritySubmit).not.toHaveBeenCalled();
	});

	it("transform and submit security vulnerability to jira", async () => {
		const jiraPayload = { vulnerabilities: [] };
		mockTransformCodeScanningAlertToJiraSecurity.mockResolvedValueOnce(jiraPayload);
		mockJiraSecuritySubmit.mockResolvedValueOnce({ status: 200 });
		await codeScanningAlertWebhookHandler(
			getWebhookContext(),
			jiraClient,
			undefined,
			GITHUB_INSTALLATION_ID
		);
		expect(jiraClient.security.submitVulnerabilities).toHaveBeenCalledWith(jiraPayload);
		expect(mockEmitWebhookProcessedMetrics).toHaveBeenCalledWith(WEBHOOK_RECEIVED, "code_scanning_alert_security", JIRA_BASE_URL, expect.any(Logger), 200, undefined);
		expect(mockJiraRemoteLinkSubmit).not.toHaveBeenCalled();
	});

	it("transform and submit remote link and security vulnerability to jira", async () => {
		const remoteLinksJiraPayload = { remoteLinks: [] };
		const securityJiraPayload = { vulnerabilities: [] };
		mockTransformCodeScanningAlert.mockResolvedValueOnce(remoteLinksJiraPayload);
		mockTransformCodeScanningAlertToJiraSecurity.mockResolvedValueOnce(securityJiraPayload);
		mockJiraRemoteLinkSubmit.mockResolvedValueOnce({ status: 200 });
		mockJiraSecuritySubmit.mockResolvedValueOnce({ status: 200 });
		await codeScanningAlertWebhookHandler(
			getWebhookContext(),
			jiraClient,
			undefined,
			GITHUB_INSTALLATION_ID
		);
		expect(jiraClient.remoteLink.submit).toHaveBeenCalledWith(remoteLinksJiraPayload);
		expect(jiraClient.security.submitVulnerabilities).toHaveBeenCalledWith(securityJiraPayload);
		expect(mockEmitWebhookProcessedMetrics).toHaveBeenCalledWith(WEBHOOK_RECEIVED, ALERT_NAME, JIRA_BASE_URL, expect.any(Logger), 200, undefined);
		expect(mockEmitWebhookProcessedMetrics).toHaveBeenCalledWith(WEBHOOK_RECEIVED, "code_scanning_alert_security", JIRA_BASE_URL, expect.any(Logger), 200, undefined);
	});

	it("not transform and submit security vulnerability to jira when enable-github-security-in-jira feature flag is off", async () => {
		mockBooleanFlag.mockResolvedValueOnce(false);
		await codeScanningAlertWebhookHandler(
			getWebhookContext(),
			jiraClient,
			undefined,
			GITHUB_INSTALLATION_ID
		);
		expect(mockTransformCodeScanningAlertToJiraSecurity).not.toHaveBeenCalled();
		expect(jiraClient.security.submitVulnerabilities).not.toHaveBeenCalled();
	});
});

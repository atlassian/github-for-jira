import Logger from "bunyan";
import {
	JiraVulnerabilityStatusEnum
} from "../interfaces/jira";
import { WebhookContext } from "../routes/github/webhook/webhook-context";
import { envVars } from "config/env";
import {
	GITHUB_CLOUD_API_BASEURL,
	GITHUB_CLOUD_BASEURL
} from "~/src/github/client/github-client-constants";
import { transformSecretScanningAlert } from "./transform-secret-scanning-alert";

jest.mock("utils/webhook-utils");

const getContext = (state): WebhookContext => ({
	id: "1",
	name: "secret_scanning_alert",
	action: state,
	payload: {
		alert: {
			number: 123,
			html_url: "https://sample/123",
			created_at: "2022-01-01T00:00:00Z",
			updated_at: "2022-01-01T00:00:00Z",
			secret_type: "personal_access_token"
		},

		repository: {
			id: 1
		}
	},
	log: { info: jest.fn() } as unknown as Logger,

	gitHubAppConfig: {
		uuid: undefined,
		gitHubAppId: undefined,
		appId: parseInt(envVars.APP_ID),
		clientId: envVars.GITHUB_CLIENT_ID,
		gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
		gitHubApiUrl: GITHUB_CLOUD_API_BASEURL
	}
});

describe("transformSecretScanningAlert", () => {
	const jiraHost = "https://jira.example.com";
	const RealDate = Date.now;

	beforeAll(() => {
		global.Date.now = jest.fn(() => new Date("2019-04-07T10:20:30Z").getTime());
	});

	afterAll(() => {
		global.Date.now = RealDate;
	});

	it.each([
		["created", JiraVulnerabilityStatusEnum.OPEN],
		["reopened", JiraVulnerabilityStatusEnum.OPEN],
		["open", JiraVulnerabilityStatusEnum.OPEN],
		["resolved", JiraVulnerabilityStatusEnum.CLOSED],
		["revoked", JiraVulnerabilityStatusEnum.CLOSED],
		["unmapped_state", JiraVulnerabilityStatusEnum.UNKNOWN]
	])("should correctly transform secret scanning alert with state %s", async (state, expectedStatus) => {
		const context = getContext(state);
		const result = await transformSecretScanningAlert(context, jiraHost);
		expect(result.vulnerabilities[0].status).toEqual(expectedStatus);
	});

	it("should log unmapped state", async () => {
		const context = getContext("unmapped_state");
		await transformSecretScanningAlert(context, jiraHost);
		expect(context.log.info).toHaveBeenCalledWith("Received unmapped state from secret_scanning_alert webhook: unmapped_state");
	});

	it("should correctly map display name identifiers", async () => {
		const context = getContext("created");
		const result = await transformSecretScanningAlert(context, jiraHost);
		expect(result.vulnerabilities).toEqual([
			{
				"containerId": "1",
				"description": "Secret scanning alert",
				"displayName": "personal_access_token secret exposed",
				"id": "s-1-123",
				"identifiers": [{
					"displayName": "personal_access_token",
					"url": "https://sample/123"
				}],
				"introducedDate": "2022-01-01T00:00:00Z",
				"lastUpdated": "2022-01-01T00:00:00Z",
				"schemaVersion": "1.0",
				"severity": {
					"level": "critical"
				},
				"status": "open",
				"type": "sast",
				"updateSequenceNumber": Date.now(),
				"url": "https://sample/123"
			}
		]);
	});
});


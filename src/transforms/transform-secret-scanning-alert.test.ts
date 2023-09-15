import Logger from "bunyan";
import { transformSecretScanningAlert } from "./transform-secret-scanning-alert";
import { JiraVulnerabilityStatusEnum } from "../interfaces/jira";

jest.mock("utils/webhook-utils");

describe("transformSecretScanningAlert", () => {
	const jiraHost = "https://jira.example.com";
	const RealDate = Date.now;
	let logger;

	beforeAll(() => {
		global.Date.now = jest.fn(() => new Date("2019-04-07T10:20:30Z").getTime());
	});

	afterAll(() => {
		global.Date.now = RealDate;
	});

	beforeEach(() => {
		logger = { info: jest.fn() } as unknown as Logger;
	});

	it.each([
		["open", JiraVulnerabilityStatusEnum.OPEN],
		["resolved", JiraVulnerabilityStatusEnum.CLOSED],
		["unmapped_state", JiraVulnerabilityStatusEnum.UNKNOWN]
	])("should correctly transform secret scanning alert with state %s", async (state, expectedStatus) => {
		const result = await transformSecretScanningAlert(getSecretScanningAlert(state), repository, jiraHost, undefined, logger);
		expect(result.vulnerabilities[0].status).toEqual(expectedStatus);
	});

	it("should log unmapped state", async () => {
		await transformSecretScanningAlert(getSecretScanningAlert("unmapped_state"), repository, jiraHost, undefined, logger);
		expect(logger.info).toHaveBeenCalledWith("Received unmapped state from secret_scanning_alert webhook: unmapped_state");
	});

	it("should correctly map display name identifiers", async () => {
		const result = await transformSecretScanningAlert(getSecretScanningAlert("open"), repository, jiraHost, undefined, logger);

		expect(result.vulnerabilities).toEqual([
			{
				"containerId": "1",
				"description": "**Vulnerability:** Fix GitHub Personal Access Token\n\n**State:** Open\n\n**Secret type:** personal_access_token\n\nVisit the vulnerability’s [secret scanning alert page](https://sample/123) in GitHub to learn more about the potential active secret and remediation steps.",
				"displayName": "GitHub Personal Access Token",
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

const getSecretScanningAlert = (state) => {
	return {
		number: 123,
		url: "https://sample/123",
		html_url: "https://sample/123",
		locations_url: "https://sample/123",
		created_at: "2022-01-01T00:00:00Z",
		updated_at: "2022-01-01T00:00:00Z",
		secret_type: "personal_access_token",
		state: state,
		secret_type_display_name: "GitHub Personal Access Token"
	};
};

const repository: any = {
	id: 1,
	owner: {
		login: "user"
	},
	name: "repo"
};

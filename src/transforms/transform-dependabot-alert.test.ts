import Logger from "bunyan";
import {
	JiraVulnerabilityStatusEnum
} from "../interfaces/jira";
import { WebhookContext } from "../routes/github/webhook/webhook-context";
import { transformDependabotAlert } from "./transform-dependabot-alert";
import { envVars } from "config/env";
import {
	GITHUB_CLOUD_API_BASEURL,
	GITHUB_CLOUD_BASEURL
} from "~/src/github/client/github-client-constants";


const getContext = (state): WebhookContext => ({
	id: "1",
	name: "dependabot_alert",
	payload: {
		alert: {
			security_advisory: {
				summary: "Test summary",
				description: "Test description",
				identifiers: [{ value: "CVE-123" }],
				references: [{ url: "https://example.com/CVE-123" }]
			},
			security_vulnerability: {
				severity: "high"
			},
			dependency: {
				manifest_path: "path/to/manifest"
			},
			html_url: "https://example.com/alert/1",
			created_at: "2021-01-01T00:00:00Z",
			updated_at: "2021-01-02T00:00:00Z",
			state: state,
			number: 1
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

describe("transformDependabotAlert", () => {
	const gitHubInstallationId = 1;
	const jiraHost = "https://jira.example.com";

	it.each([
		["open", JiraVulnerabilityStatusEnum.OPEN],
		["fixed", JiraVulnerabilityStatusEnum.CLOSED],
		["dismissed", JiraVulnerabilityStatusEnum.IGNORED],
		["auto_dismissed", JiraVulnerabilityStatusEnum.IGNORED],
		["unmapped_state", JiraVulnerabilityStatusEnum.UNKNOWN]
	])("should correctly transform dependabot alert with state %s", async (state, expectedStatus) => {
		const context = getContext(state);
		const result = await transformDependabotAlert(context, gitHubInstallationId, jiraHost);
		expect(result.vulnerabilities[0].status).toEqual(expectedStatus);
	});

	it("should log unmapped state", async () => {
		const context = getContext("unmapped_state");
		await transformDependabotAlert(context, gitHubInstallationId, jiraHost);
		expect(context.log.info).toHaveBeenCalledWith("Received unmapped state from dependabot_alert webhook: unmapped_state");
	});

	it("should correctly map vulnerability identifiers", async () => {
		const context = getContext("open");
		const result = await transformDependabotAlert(context, gitHubInstallationId, jiraHost);
		expect(result.vulnerabilities[0].identifiers).toEqual([
			{ displayName: "CVE-123", url: "https://example.com/CVE-123" }
		]);
	});
});


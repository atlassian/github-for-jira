import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { deleteRepositoryWebhookHandler } from "~/src/github/repository";
import { v4 as uuid } from "uuid";
import { GitHubServerApp } from "models/github-server-app";
import fs from "fs";
import path from "path";
import { Subscription } from "models/subscription";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import pullRequestRemoveKeys from "fixtures/pull-request-remove-keys.json";
import { getLogger } from "config/logger";

jest.mock("config/feature-flags");

describe('deleteRepositoryWebhookHandler', () => {

	beforeEach(() => {
		when(booleanFlag).calledWith(
			BooleanFlags.GHE_SERVER,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(true);
	});

	it('should call delete repository endpoint for server', async () => {
		const GHES_GITHUB_UUID = uuid();
		const GHES_GITHUB_APP_ID = 1234;
		const GHES_GITHUB_APP_NAME = "test_app";
		const GHES_GITHUB_APP_CLIENT_ID = "client_id";
		const GHES_GITHUB_APP_CLIENT_SECRET = "client_secret";
		const GHES_GITHUB_APP_WEBHOOK_SECRET = "webhook_secret";
		const GITHUB_INSTALLATION_ID = 321;
		const JIRA_INSTALLATION_ID = 111;
		const JIRA_CLIENT_KEY = "jira-key";

		const gitHubServerApp = await GitHubServerApp.install({
			uuid: GHES_GITHUB_UUID,
			appId: GHES_GITHUB_APP_ID,
			gitHubBaseUrl: gheUrl,
			gitHubClientId: GHES_GITHUB_APP_CLIENT_ID,
			gitHubClientSecret: GHES_GITHUB_APP_CLIENT_SECRET,
			webhookSecret: GHES_GITHUB_APP_WEBHOOK_SECRET,
			privateKey: fs.readFileSync(path.resolve(__dirname, "../../test/setup/test-key.pem"), { encoding: "utf8" }),
			gitHubAppName: GHES_GITHUB_APP_NAME,
			installationId: JIRA_INSTALLATION_ID
		});

		await Subscription.install({
			installationId: GITHUB_INSTALLATION_ID,
			host: jiraHost,
			gitHubAppId: gitHubServerApp.id,
			clientKey: JIRA_CLIENT_KEY
		});

		const jiraClientDevinfoRepositoryDeleteMock = jest.fn();

		await deleteRepositoryWebhookHandler(new WebhookContext({
			id: "my-id",
			name: pullRequestRemoveKeys.name,
			payload: pullRequestRemoveKeys.payload,
			log: getLogger("test"),
			gitHubAppConfig: {
				gitHubAppId: gitHubServerApp.id,
				appId: gitHubServerApp.appId,
				clientId: gitHubServerApp.gitHubClientId,
				gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
				gitHubApiUrl: gheApiUrl,
				uuid: gitHubServerApp.uuid
			}
		}), {
			baseURL: jiraHost,
			devinfo: {
				repository: {
					delete: jiraClientDevinfoRepositoryDeleteMock
				}
			}
		}, jest.fn(), GITHUB_INSTALLATION_ID);
		expect(jiraClientDevinfoRepositoryDeleteMock.mock.calls[0][0]).toEqual("6769746875626d79646f6d61696e636f6d-test-repo-id");
	});
});

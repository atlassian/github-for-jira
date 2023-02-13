import { deleteRepositoryWebhookHandler } from "~/src/github/repository";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import pullRequestRemoveKeys from "fixtures/pull-request-remove-keys.json";
import { getLogger } from "config/logger";
import { DatabaseStateCreator } from "test/utils/database-state-creator";

describe("deleteRepositoryWebhookHandler", () => {

	it("should call delete repository endpoint for server", async () => {

		const builderResult = await new DatabaseStateCreator()
			.forServer()
			.create();
		const gitHubServerApp = builderResult.gitHubServerApp!;

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
		}, jest.fn(), DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		expect(jiraClientDevinfoRepositoryDeleteMock.mock.calls[0][0]).toEqual("6769746875626d79646f6d61696e636f6d-test-repo-id");
	});
});

import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { deleteRepositoryWebhookHandler, createRepositoryWebhookHandler } from "~/src/github/repository";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import pullRequestRemoveKeys from "fixtures/pull-request-remove-keys.json";
import { getLogger } from "config/logger";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { Subscription } from "models/subscription";
import { findOrStartSync } from "~/src/sync/sync-utils";

jest.mock("config/feature-flags");
jest.mock("~/src/sync/sync-utils");

describe("deleteRepositoryWebhookHandler", () => {

	it("should call delete repository endpoint for server", async () => {

		const builderResult = await new DatabaseStateCreator()
			.forServer()
			.withActiveRepoSyncState()
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
		}, DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		expect(jiraClientDevinfoRepositoryDeleteMock.mock.calls[0][0]).toEqual("6769746875626d79646f6d61696e636f6d-test-repo-id");
	});
});

describe("createdRepositoryWebhookHandler", () => {

	let subscription;
	beforeEach(async () => {

		when(booleanFlag).calledWith(
			BooleanFlags.REPO_CREATED_EVENT
		).mockResolvedValue(true);

		subscription = await Subscription.create({
			id: 123,
			gitHubInstallationId: 123,
			jiraHost: jiraHost,
			jiraClientKey: "client-key",
			totalNumberOfRepos: 99
		});
		subscription.update = jest.fn();
	});

	it("should call created repository endpoint for server", async () => {

		const context = {
			repository: {
				id: 1,
				name: "name",
				full_name: "owner/name",
				html_url: "webaddress",
				updated_at: 0,
				owner: {
					login: "owner"
				}
			}
		};

		const builderResult = await new DatabaseStateCreator()
			.forServer()
			.create();
		const gitHubServerApp = builderResult.gitHubServerApp!;

		await createRepositoryWebhookHandler(new WebhookContext({
			id: "123",
			name: "name",
			payload: context,
			log: getLogger("test"),
			gitHubAppConfig: {
				gitHubAppId: gitHubServerApp.id,
				appId: gitHubServerApp.appId,
				clientId: gitHubServerApp.gitHubClientId,
				gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
				gitHubApiUrl: gheApiUrl,
				uuid: gitHubServerApp.uuid
			}
		}), DatabaseStateCreator.GITHUB_INSTALLATION_ID, subscription);

		expect(subscription.update).toBeCalledWith({ totalNumberOfRepos: 100 });
		expect(findOrStartSync).toBeCalledWith(subscription, expect.anything(), "partial");
	});
});

import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { deleteRepositoryWebhookHandler, createRepositoryWebhookHandler } from "~/src/github/repository";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import pullRequestRemoveKeys from "fixtures/pull-request-remove-keys.json";
import { getLogger } from "config/logger";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";

jest.mock("config/feature-flags");
jest.mock("~/src/sync/sync-utils");

describe("deleteRepositoryWebhookHandler", () => {
	let subscription;
	beforeEach(async () => {

		subscription = await Subscription.create({
			id: 123,
			gitHubInstallationId: 123,
			jiraHost: jiraHost,
			jiraClientKey: "client-key",
			totalNumberOfRepos: 99
		});
		subscription.update = jest.fn();
	});

	it("should call delete repository endpoint for server", async () => {
		const context = {
			repository: {
				id: 123,
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
			.withActiveRepoSyncState()
			.create();
		const gitHubServerApp = builderResult.gitHubServerApp!;

		const jiraClientDevinfoRepositoryDeleteMock = jest.fn();
		const jiraClientDeploymentDeleteMock = jest.fn();
		const jiraClientWorkflowDeleteMock = jest.fn();
		await deleteRepositoryWebhookHandler(new WebhookContext({
			id: "my-id",
			name: pullRequestRemoveKeys.name,
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
		}), {
			baseURL: jiraHost,
			devinfo: {
				repository: {
					delete: jiraClientDevinfoRepositoryDeleteMock
				}
			},
			deployment: {
				delete: jiraClientDeploymentDeleteMock
			},
			workflow: {
				delete: jiraClientWorkflowDeleteMock
			}
		}, DatabaseStateCreator.GITHUB_INSTALLATION_ID,
		subscription);

		expect(jiraClientDeploymentDeleteMock.mock.calls[0][0]).toEqual(123);
		expect(jiraClientWorkflowDeleteMock.mock.calls[0][0]).toEqual(123);
		expect(jiraClientDevinfoRepositoryDeleteMock.mock.calls[0][0]).toEqual("6769746875626d79646f6d61696e636f6d-123");
	});
});

describe("createdRepositoryWebhookHandler", () => {

	let subscription;
	let repoOne;

	beforeEach(async () => {

		when(booleanFlag).calledWith(
			BooleanFlags.REPO_CREATED_EVENT
		).mockResolvedValue(true);

		subscription = await Subscription.create({
			id: 123,
			gitHubInstallationId: 123,
			jiraHost: jiraHost,
			jiraClientKey: "client-key",
			totalNumberOfRepos: 1
		});
		subscription.update = jest.fn();

		repoOne = {
			subscriptionId: subscription.id,
			repoId: 1,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira"
		};

		await RepoSyncState.create({
			...repoOne,
			branchStatus: "complete",
			branchCursor: "foo",
			commitStatus: "complete",
			commitCursor: "bar",
			pullStatus: "complete",
			pullCursor: "12"
		});
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

		expect(subscription.update).toBeCalledWith({ totalNumberOfRepos: 2 });
	});
});

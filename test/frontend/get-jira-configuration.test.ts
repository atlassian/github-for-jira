/* eslint-disable @typescript-eslint/no-explicit-any */
import getJiraConfiguration from "../../src/frontend/get-jira-configuration";
import { Installation, RepoSyncState, Subscription } from "../../src/models";
// import InstallationClass from "../../src/models/installation";
import SubscriptionClass from "../../src/models/subscription";

describe("Jira Configuration Suite", () => {
	let subscription: SubscriptionClass;
	// let installation: InstallationClass;

	beforeEach(async () => {
		subscription = await Subscription.create({
			gitHubInstallationId: 15,
			jiraHost,
			jiraClientKey: "clientKey",
			syncWarning: "some warning"
		});

		await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: 1,
			repoName: "test-repo-name",
			repoOwner: "integrations",
			repoFullName: "integrations/test-repo-name",
			repoUrl: "test-repo-url",
			pullStatus: "pending",
			branchStatus: "complete",
			commitStatus: "complete"
		});

		await Installation.create({
			jiraHost,
			clientKey: "abc123",
			secrets: "def234",
			sharedSecret: "ghi345"
		});
	});

	afterEach(async () => {
		await Subscription.destroy({ truncate: true });
		await Installation.destroy({ truncate: true });
		await RepoSyncState.destroy({ truncate: true });
	});

	const mockRequest = (): any => ({
		query: { xdm_e: "https://somejirasite.atlassian.net" },
		csrfToken: jest.fn().mockReturnValue({}),
		log: {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn()
		}
	});

	const mockResponse = (): any => ({
		locals: {
			jiraHost,
			client: {
				apps: {
					getInstallation: jest.fn().mockReturnValue({ data: {} })
				}
			}
		},
		render: jest.fn().mockReturnValue({}),
		status: jest.fn().mockReturnValue({}),
		send: jest.fn().mockReturnValue({})
	});

	it("should return success message after page is rendered", async () => {
		const response = mockResponse();
		await getJiraConfiguration(mockRequest(), response, jest.fn());
		expect(response.render.mock.calls[0][1].connections[0].totalNumberOfRepos).toBe(1);
	});
});

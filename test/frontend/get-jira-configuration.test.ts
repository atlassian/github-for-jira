/* eslint-disable @typescript-eslint/no-explicit-any */
import { JiraConfigurationGet } from "../../src/routes/jira/configuration/jira-configuration-get";
import { Installation, RepoSyncState, Subscription } from "../../src/models";
import SubscriptionClass from "../../src/models/subscription";

jest.mock("../../src/util/analytics-client");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sendAnalytics } = require("../../src/util/analytics-client");

describe("Jira Configuration Suite", () => {
	let subscription: SubscriptionClass;

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

	const mockRequest = (): any => ({
		query: { xdm_e: jiraHost },
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
		await JiraConfigurationGet(mockRequest(), response, jest.fn());
		const data = response.render.mock.calls[0][1];
		expect(data.hasConnections).toBe(true);
		expect(data.failedConnections.length).toBe(0);
		expect(data.successfulConnections.length).toBe(1);
		expect(sendAnalytics).toHaveBeenCalledTimes(1);
	});
});

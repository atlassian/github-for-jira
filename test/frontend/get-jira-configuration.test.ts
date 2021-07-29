/* eslint-disable @typescript-eslint/no-explicit-any */
import { mocked } from "ts-jest/utils";
import getJiraConfiguration from "../../src/frontend/get-jira-configuration";
import { Installation, Subscription } from "../../src/models";

jest.mock("../../src/models");

describe("Jira Configuration Suite", () => {
	let consoleSpy: jest.SpyInstance;
	let subscriptions;
	let installation;

	beforeAll(() => {
		// Create a spy on console (console.error in this case) and provide some mocked implementation
		// In mocking global objects it's usually better than simple `jest.fn()`
		// because you can `unmock` it in clean way doing `mockRestore`
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {
		});
	});

	beforeEach(async () => {
		subscriptions = [
			{
				gitHubInstallationId: 15,
				jiraHost: "https://test-host.jira.com",
				destroy: jest.fn().mockResolvedValue(undefined),
				isInProgressSyncStalled: jest.fn().mockResolvedValue(undefined),
				syncWarning: "some warning",
				updatedAt: "2018-04-18T15:42:13Z",
				repoSyncState: {
					installationId: 12345678,
					jiraHost: "https://test-host.jira.com",
					repos: {
						"test-repo-id": {
							repository: {
								name: "test-repo-name",
								full_name: "test-repo-name",
								owner: { login: "integrations" },
								html_url: "test-repo-url",
								id: "test-repo-id",
								updated_at: 123456789
							},
							pullStatus: "pending",
							branchStatus: "complete",
							commitStatus: "complete"
						}
					}
				}
			}
		];

		installation = {
			id: 19,
			jiraHost: subscriptions[0].jiraHost,
			clientKey: "abc123",
			enabled: true,
			secrets: "def234",
			sharedSecret: "ghi345",
			subscriptions: jest.fn().mockResolvedValue([])
		};

		mocked(Installation.getForHost).mockImplementation(() => installation);
		mocked(Subscription.getAllForHost).mockResolvedValue(subscriptions);
	});

	// Restore mock after all tests are done, so it won't affect other test suites
	afterAll(() => consoleSpy.mockRestore());

	// Clear mock (all calls etc) after each test.
	// It's needed when you're using console somewhere in the tests so you have clean mock each time
	afterEach(() => consoleSpy.mockClear());

	const mockRequest = (): any => ({
		query: { xdm_e: "https://somejirasite.atlassian.net" },
		session: { jiraHost: subscriptions[0].jiraHost },
		csrfToken: jest.fn().mockReturnValue({}),
		log: jest.fn().mockReturnValue({})
	});

	const mockResponse = (): any => ({
		locals: {
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

	it("should return success message after page is rendered", async () =>
		await expect(
			getJiraConfiguration(mockRequest(), mockResponse(), jest.fn())
		).toResolve());
});

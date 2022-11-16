/* eslint-disable @typescript-eslint/no-explicit-any */
import { getHashedKey } from "models/sequelize";
import { mocked } from "ts-jest/utils";
import { Subscription } from "models/subscription";
import { JiraEventsUninstallPost } from "./jira-events-uninstall-post";

jest.mock("models/subscription");

describe("Webhook: /events/uninstalled", () => {
	let installation;
	let subscriptions;

	beforeEach(async () => {
		subscriptions = [
			{
				gitHubInstallationId: 10,
				jiraHost: "https://test-host.jira.com",
				uninstall: jest.fn().mockName("uninstall").mockResolvedValue(1)
			}
		];

		installation = {
			id: 19,
			jiraHost: "https://test-host.jira.com",
			clientKey: getHashedKey("abc123"),
			enabled: true,
			uninstall: jest
				.fn()
				.mockName("uninstall")
				.mockResolvedValue(installation),
			subscriptions: jest
				.fn()
				.mockName("subscriptions")
				.mockResolvedValue(subscriptions)
		};

		// Allows us to modify subscriptions before it's finally called
		mocked(Subscription.getAllForHost).mockImplementation(() => subscriptions);
	});

	it("Existing Installation", async () => {
		const req = { log: { info: jest.fn() } } as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		await JiraEventsUninstallPost(req, res);

		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(installation.uninstall).toHaveBeenCalled();
		expect(subscriptions[0].uninstall).toHaveBeenCalled();
	});

	it("Existing Installation, no Subscriptions", async () => {
		const req = { log: { info: jest.fn() } } as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		subscriptions = [];
		await JiraEventsUninstallPost(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(installation.uninstall).toHaveBeenCalled();
	});
});

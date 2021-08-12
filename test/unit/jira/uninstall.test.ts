/* eslint-disable @typescript-eslint/no-explicit-any */
import testTracking from "../../setup/tracking";
import { getHashedKey } from "../../../src/backend/models/installation";
import { mocked } from "ts-jest/utils";
import { Subscription } from "../../../src/backend/models";
import uninstall from "../../../src/backend/jira/uninstall";

jest.mock("../../../src/backend/models");

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
			secrets: "def234",
			sharedSecret: "ghi345",
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
		await testTracking();

		const req = { log: { info: jest.fn() } } as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		await uninstall(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(installation.uninstall).toHaveBeenCalled();
		expect(subscriptions[0].uninstall).toHaveBeenCalled();
	});

	it("Existing Installation, no Subscriptions", async () => {
		await testTracking();

		const req = { log: { info: jest.fn() } } as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		subscriptions = [];
		await uninstall(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(installation.uninstall).toHaveBeenCalled();
	});
});

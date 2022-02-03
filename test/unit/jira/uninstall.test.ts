/* eslint-disable @typescript-eslint/no-explicit-any */
import { getHashedKey } from "../../../src/models/installation";
import { mocked } from "ts-jest/utils";
import { Subscription } from "../../../src/models";
import uninstall from "../../../src/jira/uninstall";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "../../../src/config/feature-flags";
import { removeRepoConfig } from "../../../src/config-as-code/repo-config-service";

jest.mock("../../../src/config/feature-flags");
jest.mock("../../../src/models");
jest.mock("../../../src/config-as-code/repo-config-service");

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
		const req = { log: { info: jest.fn() } } as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		await uninstall(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(installation.uninstall).toHaveBeenCalled();
		expect(subscriptions[0].uninstall).toHaveBeenCalled();
	});

	it("Existing Installation, no Subscriptions", async () => {
		const req = { log: { info: jest.fn() } } as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		subscriptions = [];
		await uninstall(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(installation.uninstall).toHaveBeenCalled();
	});

	it("Removes repo config on uninstall", async () => {

		when(booleanFlag).calledWith(
			BooleanFlags.CONFIG_AS_CODE,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(true);

		const req = { log: { info: jest.fn() } } as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		subscriptions = [];
		await uninstall(req, res);
		expect(removeRepoConfig).toBeCalledWith(installation.id);
	});

	it("DOES NOT remove repo config on uninstall when CONFIG_AS_CODE disabled (remove this test on FF cleanup)", async () => {

		when(booleanFlag).calledWith(
			BooleanFlags.CONFIG_AS_CODE,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(false);

		const req = { log: { info: jest.fn() } } as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		subscriptions = [];
		await uninstall(req, res);
		expect(removeRepoConfig).not.toBeCalled();
	});
});

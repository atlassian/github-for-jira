/* eslint-disable @typescript-eslint/no-explicit-any */
import { getHashedKey } from "../../../src/models/installation";
import disable from "../../../src/jira/disable";

describe("Webhook: /events/disabled", () => {
	let installation;

	it("Existing Installation", async () => {
		installation = {
			id: 19,
			jiraHost: "https://test-host.jira.com",
			clientKey: getHashedKey("abc123"),
			enabled: true,
			secrets: "def234",
			sharedSecret: "ghi345",
			disable: jest.fn().mockResolvedValue(installation),
			subscriptions: jest
				.fn()
				.mockResolvedValue([{ gitHubInstallationId: 10 }])
		};

		const req = { log: { info: jest.fn() } };
		const res = { locals: { installation }, sendStatus: jest.fn() };

		await disable(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(installation.disable).toHaveBeenCalled();
	});
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import testTracking from "../../setup/tracking";
import install from "../../../src/jira/install";
import { mocked } from "ts-jest/utils";
import { Installation } from "../../../src/backend/models";

jest.mock("../../../src/backend/models");

describe("Webhook: /events/installed", () => {
	let installation;
	let body;

	beforeEach(async () => {
		body = {
			baseUrl: "https://test-host.jira.com",
			clientKey: "abc123",
			sharedSecret: "ghi345"
		};

		installation = {
			id: 19,
			jiraHost: body.baseUrl,
			clientKey: body.clientKey,
			enabled: true,
			secrets: "def234",
			sharedSecret: body.sharedSecret,
			subscriptions: jest.fn().mockResolvedValue([])
		};

		// Allows us to modify installation before it's finally called
		mocked(Installation.install).mockImplementation(() => installation);
	});

	it("Install", async () => {
		await testTracking();
		const req = { log: { info: jest.fn() }, body };
		const res = { sendStatus: jest.fn(), on: jest.fn() };

		await install(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(204);
	});
});

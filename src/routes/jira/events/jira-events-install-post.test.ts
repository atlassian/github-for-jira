/* eslint-disable @typescript-eslint/no-explicit-any */
import { JiraEventsInstallPost } from "./jira-events-install-post";
import { Installation } from "models/installation";
import { getLogger } from "config/logger";

describe("Webhook: /events/installed", () => {
	let body;

	beforeEach(async () => {
		body = {
			baseUrl: "https://test-host.jira.com",
			clientKey: "abc123",
			sharedSecret: "ghi345"
		};

	});

	it("Install", async () => {
		const req = { log: { info: jest.fn() }, body };
		const res = { sendStatus: jest.fn(), on: jest.fn() };

		await JiraEventsInstallPost(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(204);

		const inst = await Installation.getForClientKey("abc123");
		expect(inst?.plainClientKey).toBe("abc123");
	});

	it("Install event will update existing installation plainClientKey", async () => {
		const req = { log: { info: jest.fn() }, body };
		const res = { sendStatus: jest.fn(), on: jest.fn() };

		//prepare existing installation and set plainClientKey to null to mimic old data
		const { id } = await Installation.install({
			host: body.baseUrl,
			clientKey: body.clientKey,
			sharedSecret: "whatever"
		});
		await Installation.sequelize?.query(`update "Installations" set "plainClientKey" = null where "id" = ${id}`);
		const existInst = await Installation.findByPk(id);
		expect(existInst.plainClientKey).toBeNull();

		//do normal install events
		await JiraEventsInstallPost(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(204);

		//expect the plainClientKey is set
		const inst: Installation = await Installation.findByPk(id);
		expect(inst.plainClientKey).toBe("abc123");
		expect(await inst.decrypt("encryptedSharedSecret", getLogger("test"))).toBe(body.sharedSecret);
	});
});

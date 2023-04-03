/* eslint-disable @typescript-eslint/no-explicit-any */
import { JiraEventsUninstallPost } from "./jira-events-uninstall-post";
import { getLogger } from "config/logger";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { Subscription } from "models/subscription";
import { Installation } from "models/installation";

describe("Webhook: /events/uninstalled", () => {
	let installation;
	let subscription;

	beforeEach(async () => {
		const result = await (new DatabaseStateCreator().create());
		installation = result.installation;
		subscription = result.subscription;
	});

	it("Existing Installation", async () => {
		const req = { log: getLogger("test") } as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		jiraNock.delete("/rest/atlassian-connect/latest/addons/com.github.integration.test-atlassian-instance/properties/is-configure");

		await JiraEventsUninstallPost(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(await Installation.findByPk(installation.id)).toBeNull();
		expect(await Subscription.findByPk(subscription.id)).toBeNull();
	});

	it("Existing Installation, no Subscriptions", async () => {
		const req = { log: getLogger("test") } as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;
		await subscription.destroy();

		jiraNock.delete("/rest/atlassian-connect/latest/addons/com.github.integration.test-atlassian-instance/properties/is-configure");

		await JiraEventsUninstallPost(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(await Installation.findByPk(installation.id)).toBeNull();
	});
});

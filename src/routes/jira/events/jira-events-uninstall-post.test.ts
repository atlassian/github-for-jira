/* eslint-disable @typescript-eslint/no-explicit-any */
import { getHashedKey } from "models/sequelize";
import { mocked } from "ts-jest/utils";
import { Subscription } from "models/subscription";
import { JiraEventsUninstallPost } from "./jira-events-uninstall-post";
import { getLogger } from "config/logger";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { Installation } from "models/installation";

jest.mock("models/subscription");

describe("Webhook: /events/uninstalled", () => {
	let installation;
	let subscriptions;
	let client: any;

	beforeEach(async () => {
		installation = await Installation.create({
			jiraHost,
			clientKey: "client-key",
			encryptedSharedSecret: "shared-secret"
		});

		subscriptions = [
			{
				gitHubInstallationId: 10,
				jiraHost: "https://test-host.jira.com",
				uninstall: jest.fn().mockName("uninstall").mockResolvedValue(1)
			}
		];

		// installation = {
		// 	id: 19,
		// 	jiraHost: "https://test-host.jira.com",
		// 	clientKey: getHashedKey("abc123"),
		// 	enabled: true,
		// 	uninstall: jest
		// 		.fn()
		// 		.mockName("uninstall")
		// 		.mockResolvedValue(installation),
		// 	subscriptions: jest
		// 		.fn()
		// 		.mockName("subscriptions")
		// 		.mockResolvedValue(subscriptions)
		// };

		// Allows us to modify subscriptions before it's finally called
		mocked(Subscription.getAllForHost).mockImplementation(() => subscriptions);
		client = await getJiraClient(jiraHost, undefined, undefined, undefined);
	});

	it("Existing Installation", async () => {
		const req = { log: getLogger("request")  } as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		jiraNock
			.delete("/rest/atlassian-connect/1/addons/testappkey/properties/isConfigured")
			.reply(200, "OK");

		await JiraEventsUninstallPost(req, res);
		await client.appProperties.delete("testappkey");
		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(installation.uninstall).toHaveBeenCalled();
		expect(subscriptions[0].uninstall).toHaveBeenCalled();
	});

	it("Existing Installation, no Subscriptions", async () => {
		const req = { log: getLogger("request") } as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		jiraNock
			.delete("/rest/atlassian-connect/1/addons/testappkey/properties/isConfigured")
			.reply(200, "OK");

		subscriptions = [];
		await JiraEventsUninstallPost(req, res);
		await client.appProperties.delete("testappkey");
		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(installation.uninstall).toHaveBeenCalled();
	});
});

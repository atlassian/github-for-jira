import { Installation, Subscription } from "../../../../src/models";
import InstallationClass from "../../../../src/models/installation";
import SubscriptionClass from "../../../../src/models/subscription";
import getJiraClient from "../../../../src/jira/client";
import envVars from "../../../../src/config/env";

describe("Test getting a jira client", () => {
	const gitHubInstallationId = Math.round(Math.random()*10000);
	let installation: InstallationClass;
	let subscription: SubscriptionClass;
	let client;

	beforeEach(async () => {
		installation = await Installation.install({
			host: envVars.ATLASSIAN_URL,
			sharedSecret: "shared-secret",
			clientKey: "client-key"
		});
		await installation.enable();
		subscription = await Subscription.create({
			jiraHost: envVars.ATLASSIAN_URL,
			gitHubInstallationId
		});
		client = await getJiraClient(envVars.ATLASSIAN_URL, gitHubInstallationId);
	});

	afterEach(async () => {
		await installation.destroy();
		await subscription.destroy();
	})

	it("Installation exists", async () => {
		expect(client).toMatchSnapshot();
	});

	it("Installation does not exist", async () => {
		await installation.disable();
		expect(await getJiraClient(envVars.ATLASSIAN_URL, gitHubInstallationId)).not.toBeDefined();
	});

	it("Should truncate issueKeys if over the limit", async () => {
		jiraNock.post("/rest/devinfo/0.10/bulk").reply(200);

		await client.devinfo.repository.update({
			commits: [
				{
					author: {
						email: "blarg@email.com",
						name: "foo"
					},
					authorTimestamp: "Tue Oct 19 2021 11:52:08 GMT+1100",
					displayId: "oajfojwe",
					fileCount: 3,
					hash: "hashihashhash",
					id: "id",
					issueKeys: Array.from(new Array(125)).map((_,i) => `TEST-${i}`),
					message: "commit message",
					url: "some-url",
					updateSequenceId: 1234567890
				}
			]
		});
		await subscription.reload();
		expect(subscription.syncWarning).toEqual("Exceeded issue key reference limit. Some issues may not be linked.");
	});
});

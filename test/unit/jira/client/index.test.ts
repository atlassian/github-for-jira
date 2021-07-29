import { Installation } from "../../../../src/models";
import getJiraClient from "../../../../src/jira/client";

describe("Test getting a jira client", () => {
	const BASE_URL = "https://base-url.atlassian.net";

	beforeEach(async () => {
		const installation = await Installation.install({
			host: BASE_URL,
			sharedSecret: "shared-secret",
			clientKey: "client-key"
		});

		await installation.enable();
	});

	it("Installation exists", async () => {
		const client = await getJiraClient(BASE_URL, 1);
		expect(client).toMatchSnapshot();
	});

	it("Installation does not exist", async () => {
		const installation = await Installation.findOne({
			where: {
				jiraHost: BASE_URL
			}
		});
		await installation.disable();

		const client = await getJiraClient(BASE_URL, 1);
		expect(client).not.toBeDefined();
	});
});

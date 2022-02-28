/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation, Subscription } from "../../../src/models";
import { mocked } from "ts-jest/utils";
import { JiraConfigurationDelete } from "../../../src/routes/jira/configuration/jira-configuration-delete";
import { getLogger } from "../../../src/config/logger";

jest.mock("../../../src/models");

describe("DELETE /jira/configuration", () => {
	let installation;
	let subscription;

	beforeEach(async () => {
		subscription = {
			githubInstallationId: 15,
			jiraHost,
			destroy: jest.fn().mockResolvedValue(undefined)
		};

		installation = {
			id: 19,
			jiraHost,
			clientKey: "abc123",
			enabled: true,
			secrets: "def234",
			sharedSecret: "ghi345",
			subscriptions: jest.fn().mockResolvedValue([])
		};

		mocked(Subscription.getSingleInstallation).mockResolvedValue(subscription);
		mocked(Installation.getForHost).mockResolvedValue(installation);
	});

	it("Delete Jira Configuration", async () => {
		jiraNock
			.delete("/rest/devinfo/0.10/bulkByProperties")
			.query({ installationId: subscription.githubInstallationId })
			.reply(200, "OK");

		jiraNock
			.delete("/rest/builds/0.1/bulkByProperties")
			.query({ gitHubInstallationId: subscription.githubInstallationId })
			.reply(200, "OK");

		jiraNock
			.delete("/rest/deployments/0.1/bulkByProperties")
			.query({ gitHubInstallationId: subscription.githubInstallationId })
			.reply(200, "OK");

		// TODO: use supertest for this
		const req = {
			log: getLogger("request"),
			body: {
				installationId: subscription.githubInstallationId,
				jiraHost: subscription.jiraHost
			}
		};

		const res = { sendStatus: jest.fn(), locals: { installation, jiraHost } };
		await JiraConfigurationDelete(req as any, res as any);
		expect(subscription.destroy).toHaveBeenCalled();
		expect(res.sendStatus).toHaveBeenCalledWith(204);
	});
});

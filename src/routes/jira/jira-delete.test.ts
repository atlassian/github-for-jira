/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { mocked } from "ts-jest/utils";
import { JiraDelete } from "./jira-delete";
import { getLogger } from "config/logger";

jest.mock("models/installation");
jest.mock("models/subscription");

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
			decrypt: jest.fn(() => "ghi345"),
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
			.query({ gitHubInstallationId: subscription.githubInstallationId, repoId: 1234 })
			.reply(200, "OK");

		jiraNock
			.delete("/rest/deployments/0.1/bulkByProperties")
			.query({ gitHubInstallationId: subscription.githubInstallationId, repoId: 1234 })
			.reply(200, "OK");

		// TODO: use supertest for this
		const req = {
			log: getLogger("request"),
			body: {
				jiraHost: subscription.jiraHost
			},
			params: {
				installationId: subscription.githubInstallationId
			}
		};

		const res = { sendStatus: jest.fn(), locals: { installation, jiraHost } };
		await JiraDelete(req as any, res as any);
		expect(subscription.destroy).toHaveBeenCalled();
		expect(res.sendStatus).toHaveBeenCalledWith(204);
	});
});

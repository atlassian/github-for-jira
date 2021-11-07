/* eslint-disable @typescript-eslint/no-explicit-any */
import nock from "nock";
import { Installation, Subscription } from "../../../src/models";
import { mocked } from "ts-jest/utils";
import deleteJiraConfiguration from "../../../src/frontend/delete-jira-configuration";
import { getLogger } from "../../../src/config/logger";

jest.mock("../../../src/models");

describe("DELETE /jira/configuration", () => {
	let installation;
	let subscription;

	beforeEach(async () => {
		subscription = {
			githubInstallationId: 15,
			jiraHost: "https://test-host.jira.com",
			destroy: jest.fn().mockResolvedValue(undefined)
		};

		installation = {
			id: 19,
			jiraHost: subscription.jiraHost,
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
		nock(subscription.jiraHost)
			.delete("/rest/devinfo/0.10/bulkByProperties")
			.query({ installationId: subscription.githubInstallationId })
			.reply(200, "OK");

		// TODO: use supertest for this
		const req = {
			log: getLogger("request"),
			body: { installationId: subscription.githubInstallationId },
			query: {
				xdm_e: subscription.jiraHost
			},
			session: {
				jiraHost: subscription.jiraHost
			}
		};

		const res = { sendStatus: jest.fn(), locals: { installation } };
		await deleteJiraConfiguration(req as any, res as any);
		expect(subscription.destroy).toHaveBeenCalled();
		expect(res.sendStatus).toHaveBeenCalledWith(204);
	});
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { getHashedKey } from "models/sequelize";
import { mocked } from "ts-jest/utils";
import { Subscription } from "models/subscription";
import { JiraEventsUninstallPost } from "./jira-events-uninstall-post";
import express, { Application } from "express";
import { getLogger } from "config/logger";
import { getFrontendApp } from "~/src/app";
import { when } from "jest-when";
import { getJiraClient } from "~/src/jira/client/jira-client";

jest.mock("models/subscription");
jest.mock("~/src/jira/client/jira-client");

describe("Webhook: /events/uninstalled", () => {
	let installation;
	let subscriptions;
	let frontendApp: Application;
	let mockJiraClient;

	beforeEach(async () => {
		subscriptions = [
			{
				gitHubInstallationId: 10,
				jiraHost: "https://test-host.jira.com",
				uninstall: jest.fn().mockName("uninstall").mockResolvedValue(1)
			}
		];

		installation = {
			id: 19,
			jiraHost: "https://test-host.jira.com",
			clientKey: getHashedKey("abc123"),
			enabled: true,
			uninstall: jest
				.fn()
				.mockName("uninstall")
				.mockResolvedValue(installation),
			subscriptions: jest
				.fn()
				.mockName("subscriptions")
				.mockResolvedValue(subscriptions)
		};

		frontendApp = express();
		frontendApp.use((request, _, next) => {
			request.log = getLogger("test");
			next();
		});
		frontendApp.use(getFrontendApp());

		mockJiraClient = {
			appProperties: {
				delete: jest.fn()
			}
		};

		// Allows us to modify subscriptions before it's finally called
		mocked(Subscription.getAllForHost).mockImplementation(() => subscriptions);
	});

	it("Existing Installation", async () => {
		when(jest.mocked(getJiraClient))
			.calledWith(jiraHost, undefined, undefined, expect.anything())
			.mockResolvedValue(mockJiraClient);

		const req = {} as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		await JiraEventsUninstallPost(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(installation.uninstall).toHaveBeenCalled();
		expect(subscriptions[0].uninstall).toHaveBeenCalled();
	});

	it("Existing Installation, no Subscriptions", async () => {
		when(jest.mocked(getJiraClient))
			.calledWith(jiraHost, undefined, undefined, expect.anything())
			.mockResolvedValue(mockJiraClient);

		const req = {} as any;
		const res = { locals: { installation }, sendStatus: jest.fn() } as any;

		subscriptions = [];
		await JiraEventsUninstallPost(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(204);
		expect(installation.uninstall).toHaveBeenCalled();
	});
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "probot/lib/logger";
import { JiraClient } from "./jira-client";

describe("JiraClient", () => {
	describe("isAuthorized()", () => {
		let jiraClient: any;

		beforeEach(async () => {
			const installation: any = {
				jiraHost,
				decrypt: jest.fn(()=> "secret")
			};

			jiraClient = await JiraClient.getNewClient(installation, logger);
		});

		it("is true when response is 200", async () => {
			jiraNock
				.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1")
				.reply(200);

			const isAuthorized = await jiraClient.isAuthorized();
			expect(isAuthorized).toBe(true);
		});

		it("is false when response is 302", async () => {
			jiraNock
				.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1")
				.reply(302);

			const isAuthorized = await jiraClient.isAuthorized();
			expect(isAuthorized).toBe(false);
		});

		it("is false when response is 403", async () => {
			jiraNock
				.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1")
				.reply(403);

			const isAuthorized = await jiraClient.isAuthorized();
			expect(isAuthorized).toBe(false);
		});

		it("rethrows non-response errors", async () => {
			jest.spyOn(jiraClient.axios, "get").mockImplementation(() => {
				throw new Error("boom");
			});

			await expect(jiraClient.isAuthorized()).rejects.toThrow("boom");
		});
	});
});

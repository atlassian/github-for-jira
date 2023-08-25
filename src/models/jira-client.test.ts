/* eslint-disable @typescript-eslint/no-explicit-any */
import { getLogger } from "config/logger";
import { JiraClient } from "./jira-client";
import { DatabaseStateCreator } from "test/utils/database-state-creator";

describe("JiraClient", () => {
	let jiraClient: JiraClient | null;
	beforeEach(async () => {
		const { installation } = await new DatabaseStateCreator().create();
		jiraClient = installation && await JiraClient.getNewClient(installation, getLogger("test"));
	});

	describe("isAuthorized()", () => {

		it("is true when response is 200", async () => {
			jiraNock
				.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1")
				.reply(200);

			const isAuthorized = await jiraClient?.isAuthorized();
			expect(isAuthorized).toBe(true);
		});

		it("is false when response is 302", async () => {
			jiraNock
				.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1")
				.reply(302);

			const isAuthorized = await jiraClient?.isAuthorized();
			expect(isAuthorized).toBe(false);
		});

		it("is false when response is 403", async () => {
			jiraNock
				.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1")
				.reply(403);

			const isAuthorized = await jiraClient?.isAuthorized();
			expect(isAuthorized).toBe(false);
		});

		it("rethrows non-response errors", async () => {
			jiraClient && jest.spyOn(jiraClient.axios, "get").mockImplementation(() => {
				throw new Error("boom");
			});

			await expect(jiraClient?.isAuthorized()).rejects.toThrow("boom");
		});
	});

	describe("appPropertiesCreate()", () => {
		test.each([true, false])("sets up %s",  async (value) => {
			jiraNock
				.put("/rest/atlassian-connect/latest/addons/com.github.integration.test-atlassian-instance/properties/is-configured", {
					isConfigured: value
				})
				.reply(200);

			expect(await jiraClient?.appPropertiesCreate(value)).toBeDefined();
		});
	});

	describe("appPropertiesGet()", () => {
		it("returns data",  async () => {
			jiraNock
				.get("/rest/atlassian-connect/latest/addons/com.github.integration.test-atlassian-instance/properties/is-configured")
				.reply(200,{
					isConfigured: true
				});

			expect(jiraClient && (await jiraClient.appPropertiesGet()).data.isConfigured).toBeTruthy();
		});
	});

	describe("appPropertiesDelete()", () => {
		it("deletes data",  async () => {
			jiraNock
				.delete("/rest/atlassian-connect/latest/addons/com.github.integration.test-atlassian-instance/properties/is-configured")
				.reply(200);

			expect(await jiraClient?.appPropertiesDelete()).toBeDefined();
		});
	});

	describe("linkedWorkspace()", () => {
		it("linked workspace",  async () => {
			jiraNock.post("/rest/security/1.0/linkedWorkspaces/bulk", {
				"workspaceIds": [123]
			}).reply(202);

			const jiraRes = await jiraClient?.linkedWorkspace(123);
			expect(jiraRes?.status).toEqual(202);
		});
	});

	describe("deleteWorkspace()", () => {
		it("delete workspace", async () => {
			jiraNock
				.delete("/rest/security/1.0/linkedWorkspaces/bulk?workspaceIds=123")
				.reply(202);

			const jiraRes = await jiraClient?.deleteWorkspace(123);
			expect(jiraRes?.status).toEqual(202);
		});
	});

	describe("deleteVulnerabilities()", () => {
		it("delete vulns", async () => {
			jiraNock
				.delete("/rest/security/1.0/bulkByProperties?workspaceId=123")
				.reply(202);

			const jiraRes = await jiraClient?.deleteVulnerabilities(123);
			expect(jiraRes?.status).toEqual(202);
		});
	});

});
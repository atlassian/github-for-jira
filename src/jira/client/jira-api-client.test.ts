/* eslint-disable @typescript-eslint/no-explicit-any */
import { getLogger } from "config/logger";
import { JiraClient } from "./jira-api-client";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { TransformedRepositoryId } from "~/src/transforms/transform-repository-id";
import { JiraBuildBulkSubmitData, JiraVulnerabilityBulkSubmitData } from "interfaces/jira";

describe("JiraClient", () => {
	let jiraClient: JiraClient | null;
	beforeEach(async () => {
		const { installation } = await new DatabaseStateCreator().create();
		jiraClient = installation && await JiraClient.create(installation, undefined, getLogger("test"));
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

	describe("getCloudId()", () => {
		it("should return cloudId data",  async () => {
			jiraNock
				.get("/_edge/tenant_info")
				.reply(200, "cat");

			const data = await jiraClient!.getCloudId();
			expect(data).toEqual("cat");
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

	describe("checkAdminPermissions()", () => {

		it("checks admin permissions successfully", async () => {
			jiraNock
				.post("/rest/api/latest/permissions/check")// TODO PASS BODY AND TEST ITS USED
				.reply(200, {});

			const result = await jiraClient?.checkAdminPermissions("123");

			expect(result?.status).toBe(200);
		});

		it("handles errors gracefully", async () => {
			jiraNock
				.post("/rest/api/latest/permissions/check")
				.reply(500);


			await expect(jiraClient?.checkAdminPermissions("123")).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

	});

	describe("getIssue()", () => {

		it("gets issue successfully", async () => {
			const response = { choice: "as" };

			jiraNock
				.get(`/rest/api/latest/issue/3?fields=summary`)
				.reply(200, response);

			const result = await jiraClient?.getIssue("3");

			expect(result?.status).toBe(200);
			expect(result?.data).toEqual(response);
		});

		it("handles errors gracefully", async () => {
			jiraNock
				.get("/rest/api/latest/issue/3?fields=summary")
				.reply(500);

			await expect(jiraClient?.getIssue("3")).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

		it("handles not found", async () => {
			jiraNock
				.get("/rest/api/latest/issue/invalid_issue_id?fields=summary")
				.reply(404);

			await expect(jiraClient?.getIssue("invalid_issue_id")).rejects.toThrow(
				"Error executing Axios Request HTTP 404"
			);
		});

	});

	describe("getAllIssues()", () => {

		const issue3 = { id: 3 };
		const issue7 = { id: 7 };

		it("gets issues successfully", async () => {
			jiraNock
				.get(`/rest/api/latest/issue/3?fields=summary`)
				.reply(200, { issue3 });
			jiraNock
				.get(`/rest/api/latest/issue/7?fields=summary`)
				.reply(200, { issue7 });

			const result = await jiraClient?.getAllIssues(["3", "7"]);

			expect(result?.length).toBe(2);
			expect.arrayContaining([
				expect.objectContaining({ "issue3": expect.objectContaining({ "id": 3 }) }),
				expect.objectContaining({ "issue7": expect.objectContaining({ "id": 7 }) })
			]);
		});

		it("handles mixture of failure and success responses", async () => {
			jiraNock
				.get(`/rest/api/latest/issue/3?fields=summary`)
				.reply(200, { issue3 });
			jiraNock
				.get(`/rest/api/latest/issue/7?fields=summary`)
				.reply(200, { issue7 });
			jiraNock
				.get(`/rest/api/latest/issue/9?fields=summary`)
				.reply(500);
			jiraNock
				.get(`/rest/api/latest/issue/fake?fields=summary`)
				.reply(404);

			const result = await jiraClient?.getAllIssues(["3", "7", "9", "fake"]);

			expect(result?.length).toBe(2);

			expect.arrayContaining([
				expect.objectContaining({ "issue3": expect.objectContaining({ "id": 3 }) }),
				expect.objectContaining({ "issue7": expect.objectContaining({ "id": 7 }) })
			]);
		});

	});

	describe("listIssueComments()", () => {

		it("lists issue comments successfully", async () => {
			const response = { choice: "as" };
			jiraNock
				.get("/rest/api/latest/issue/3/comment?expand=properties")
				.reply(200, response);

			const result = await jiraClient?.listIssueComments("3");

			expect(result?.status).toBe(200);
			expect(result?.data).toEqual(response);
		});

		it("handles errors gracefully", async () => {
			jiraNock
				.get("/rest/api/latest/issue/3/comment?expand=properties")
				.reply(500);

			await expect(jiraClient?.listIssueComments("3")).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

		it("handles not found", async () => {
			jiraNock
				.get("/rest/api/latest/issue/invalid_issue_id/comment?expand=properties")
				.reply(404);

			await expect(jiraClient?.listIssueComments("invalid_issue_id")).rejects.toThrow(
				"Error executing Axios Request HTTP 404"
			);
		});

	});

	describe("addIssueComment()", () => {

		it("adds issue comment successfully", async () => {
			jiraNock
				.post("/rest/api/latest/issue/3/comment")// TODO PASS BODY AND TEST ITS USED
				.reply(200);

			const result = await jiraClient?.addIssueComment("3", "sick new comment");

			expect(result?.status).toBe(200);
		});

		it("handles errors gracefully", async () => {
			jiraNock
				.post("/rest/api/latest/issue/3/comment")// TODO PASS BODY AND TEST ITS USED
				.reply(500);

			await expect(jiraClient?.addIssueComment("3", "comment doesnt matter for failure sadpanda")).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

	});

	describe("updateIssueComment()", () => {

		it("update issue comment successfully", async () => {
			jiraNock
				.put("/rest/api/latest/issue/3/comment/9")// TODO PASS BODY AND TEST ITS USED
				.reply(200);

			const result = await jiraClient?.updateIssueComment("3", "9", "sick new comment");

			expect(result?.status).toBe(200);
		});

		it("handles errors gracefully", async () => {
			jiraNock
				.put("/rest/api/latest/issue/3/comment/9") // TODO PASS BODY AND TEST ITS USED
				.reply(500);

			await expect(jiraClient?.updateIssueComment("3", "9", "comment doesnt matter for failure sadderpanda")).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

	});

	describe("deleteIssueComment()", () => {

		it("delete issue comment successfully", async () => {
			jiraNock
				.delete("/rest/api/latest/issue/3/comment/9")
				.reply(200);

			const result = await jiraClient?.deleteIssueComment("3", "9");

			expect(result?.status).toBe(200);
		});

		it("handles errors gracefully", async () => {
			jiraNock
				.delete("/rest/api/latest/issue/3/comment/9")
				.reply(500);

			await expect(jiraClient?.deleteIssueComment("3", "9")).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

	});

	describe("listIssueTransistions()", () => {

		it("update issue comment successfully", async () => {
			const response = { choice: "as" };
			jiraNock
				.get("/rest/api/latest/issue/3/transitions")
				.reply(200, response);

			const result = await jiraClient?.listIssueTransistions("3");

			expect(result?.status).toBe(200);
			expect(result?.data).toEqual(response);
		});

		it("handles errors gracefully", async () => {
			jiraNock
				.get("/rest/api/latest/issue/3/transitions")
				.reply(500);

			await expect(jiraClient?.listIssueTransistions("3")).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

	});

	describe("updateIssueTransistions()", () => {

		it("update issue transistion successfully", async () => {
			const requestBody = {
				transition: { id: "1" }
			};
			jiraNock
				.post("/rest/api/latest/issue/3/transitions", requestBody)
				.reply(200);

			const result = await jiraClient?.updateIssueTransistions("3", "1");

			expect(result?.status).toBe(200);
		});

		it("handles errors gracefully", async () => {
			const requestBody = {
				transition: { id: "99999" }
			};
			jiraNock
				.post("/rest/api/latest/issue/3/transitions", requestBody)
				.reply(500);

			await expect(jiraClient?.updateIssueTransistions("3", "99999")).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

	});

	describe("addWorklogForIssue()", () => {

		it("update issue transistion successfully", async () => {
			const requestBody = { choice: "as" };
			jiraNock
				.post("/rest/api/latest/issue/3/worklog", requestBody)
				.reply(200);

			const result = await jiraClient?.addWorklogForIssue("3", requestBody);

			expect(result?.status).toBe(200);
		});

		it("handles errors gracefully", async () => {
			const requestBody = { choice: "as" };
			jiraNock
				.post("/rest/api/latest/issue/3/worklog", requestBody)
				.reply(500);

			await expect(jiraClient?.addWorklogForIssue("3", requestBody)).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

	});

	describe("deleteInstallation()", () => {

		it("update issue transistion successfully", async () => {
			jiraNock
				.delete("/rest/devinfo/0.10/bulkByProperties?installationId=99")
				.reply(200);

			jiraNock
				.delete("/rest/builds/0.1/bulkByProperties?gitHubInstallationId=99")
				.reply(200);

			jiraNock
				.delete("/rest/deployments/0.1/bulkByProperties?gitHubInstallationId=99")
				.reply(200);

			const result = await jiraClient?.deleteInstallation(99);

			expect(result).toHaveLength(3);

			expect(result).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ status: 200 }),
					expect.objectContaining({ status: 200 }),
					expect.objectContaining({ status: 200 })
				])
			);
		});

		it("handles errors gracefully", async () => {
			jiraNock
				.delete("/rest/devinfo/0.10/bulkByProperties?installationId=99")
				.reply(200);

			jiraNock
				.delete("/rest/builds/0.1/bulkByProperties?gitHubInstallationId=99")
				.reply(500);

			jiraNock
				.delete("/rest/deployments/0.1/bulkByProperties?gitHubInstallationId=99")
				.reply(200);

			await expect(jiraClient?.deleteInstallation(99)).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

	});

	describe("deleteBranch()", () => {
		const repositoryId: TransformedRepositoryId = "sweet_repository_id" as TransformedRepositoryId;

		beforeEach(() => {
			jest.spyOn(Date, "now").mockImplementation(() => 100);
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it("delete branch successfully", async () => {
			jiraNock
				.delete("/rest/devinfo/0.10/repository/sweet_repository_id/branch/def333f4?_updateSequenceId=100")
				.reply(200);

			const result = await jiraClient?.deleteBranch(repositoryId, "def333f4");

			expect(result?.status).toBe(200);
		});

		it("handles errors gracefully", async () => {
			jiraNock
				.delete("/rest/devinfo/0.10/repository/sweet_repository_id/branch/def333f4?_updateSequenceId=100")
				.reply(500);

			await expect(jiraClient?.deleteBranch(repositoryId, "def333f4")).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

	});

	describe("deletePullRequest()", () => {
		const repositoryId: TransformedRepositoryId = "sweet_repository_id" as TransformedRepositoryId;

		beforeEach(() => {
			jest.spyOn(Date, "now").mockImplementation(() => 100);
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it("delete branch successfully", async () => {
			jiraNock
				.delete("/rest/devinfo/0.10/repository/sweet_repository_id/pull_request/88?_updateSequenceId=100")
				.reply(200);

			const result = await jiraClient?.deletePullRequest(repositoryId, "88");

			expect(result?.status).toBe(200);
		});

		it("handles errors gracefully", async () => {
			jiraNock
				.delete("/rest/devinfo/0.10/repository/sweet_repository_id/pull_request/88?_updateSequenceId=100")
				.reply(500);

			await expect(jiraClient?.deletePullRequest(repositoryId, "88")).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

	});

	describe("deleteRepository()", () => {

		beforeEach(() => {
			jest.spyOn(Date, "now").mockImplementation(() => 100);
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it("delete branch successfully", async () => {
			jiraNock
				.delete("/rest/devinfo/0.10/repository/22?_updateSequenceId=100")
				.reply(200);
			jiraNock
				.delete("/rest/builds/0.1/bulkByProperties?repositoryId=22")
				.reply(200);
			jiraNock
				.delete("/rest/deployments/0.1/bulkByProperties?repositoryId=22")
				.reply(200);

			const result = await jiraClient?.deleteRepository(22);

			expect(result).toHaveLength(3);

			expect(result).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ status: 200 }),
					expect.objectContaining({ status: 200 }),
					expect.objectContaining({ status: 200 })
				])
			);
		});

		it("handles errors gracefully", async () => {
			jiraNock
				.delete("/rest/devinfo/0.10/repository/22?_updateSequenceId=100")
				.reply(200);
			jiraNock
				.delete("/rest/builds/0.1/bulkByProperties?repositoryId=22")
				.reply(500);
			jiraNock
				.delete("/rest/deployments/0.1/bulkByProperties?repositoryId=22")
				.reply(200);

			await expect(jiraClient?.deleteRepository(22)).rejects.toThrow(
				"Error executing Axios Request HTTP 500"
			);
		});

	});

	describe("submitBuilds()", () => {

		it("submits builds successfully within issue key limit", async () => {

			jiraNock
				.post("/rest/builds/0.1/bulk", {
					builds: [{ name: "Build 123" }],
					properties: {
						gitHubInstallationId: jiraClient?.gitHubInstallationId, // uses the id from the mock installation creator
						repositoryId: 123
					},
					providerMetadata: {
						product: "product"
					},
					preventTransitions: false,
					operationType: "NORMAL"
				})
				.reply(200);

			const data = {
				builds: [{ name: "Build 123" }],
				product: "product"
			} as unknown as JiraBuildBulkSubmitData;

			const result = await jiraClient?.submitBuilds(data, 123);

			expect(result?.status).toBe(200);
		});

		it("handles errors gracefully", async () => {
			jiraNock
				.post("/rest/builds/0.1/bulk", {
					builds: [{ name: "Build 123" }],
					properties: {
						gitHubInstallationId: jiraClient?.gitHubInstallationId,
						repositoryId: 123
					},
					providerMetadata: {
						product: "product"
					},
					preventTransitions: false,
					operationType: "NORMAL"
				})
				.reply(500);

			const data = {
				builds: [{ name: "Build 123" }],
				product: "product"
			} as unknown as JiraBuildBulkSubmitData;

			await expect(jiraClient?.submitBuilds(data, 123)).rejects.toThrow("Error executing Axios Request HTTP 500");
		});

	});

	//TODO OTHER DEPLLYNE TEST HERE

	describe("submitRemoteLinks()", () => {

		it("submits remote links successfully", async () => {

			const remoteLinks = [
				{
					associations: [
						{
							associationType: "issueIdOrKeys",
							values: ["VALUE1", "VALUE2", "VALUE3"]
						}
					]
				}
			];

			jiraNock
				.post("/rest/remotelinks/1.0/bulk", {
					remoteLinks,
					properties: {
						gitHubInstallationId: jiraClient?.gitHubInstallationId
					},
					preventTransitions: false,
					operationType: "NORMAL"
				})
				.reply(200);

			const data = {
				remoteLinks
			};

			const result = await jiraClient?.submitRemoteLinks(data);

			expect(result?.status).toBe(200);
		});

		it("handles errors gracefully", async () => {
			const remoteLinks = [
				{
					associations: [
						{
							associationType: "issueIdOrKeys",
							values: ["VALUE1", "VALUE2", "VALUE3"]
						}
					]
				}
			];

			jiraNock
				.post("/rest/remotelinks/1.0/bulk", {
					remoteLinks,
					properties: {
						gitHubInstallationId: jiraClient?.gitHubInstallationId
					},
					preventTransitions: false,
					operationType: "NORMAL"
				})
				.reply(500);

			const data = {
				remoteLinks
			};

			await expect(jiraClient?.submitRemoteLinks(data)).rejects.toThrow("Error executing Axios Request HTTP 500");
		});

	});

	describe("submitVulnerabilities()", () => {

		it("submits vulnerabilities successfully", async () => {

			const data =
				{
					vulnerabilities: [{
						id: 1,
						displayName: "name",
						description: "oh noes"
					}]
				} as unknown as JiraVulnerabilityBulkSubmitData;

			jiraNock
				.post("/rest/security/1.0/bulk", {
					vulnerabilities: [{
						id: 1,
						displayName: "name",
						description: "oh noes"
					}],
					properties: {
						gitHubInstallationId: jiraClient?.gitHubInstallationId
					},
					operationType: "NORMAL"
				})
				.reply(200);

			const result = await jiraClient?.submitVulnerabilities(data);

			expect(result?.status).toBe(200);
		});

		it("handles errors gracefully", async () => {
			const data =
				{
					vulnerabilities: [{
						id: 1,
						displayName: "name",
						description: "oh noes"
					}]
				} as unknown as JiraVulnerabilityBulkSubmitData;

			jiraNock
				.post("/rest/security/1.0/bulk", {
					vulnerabilities: [{
						id: 1,
						displayName: "name",
						description: "oh noes"
					}],
					properties: {
						gitHubInstallationId: jiraClient?.gitHubInstallationId
					},
					operationType: "NORMAL"
				})
				.reply(500);

			await expect(jiraClient?.submitVulnerabilities(data)).rejects.toThrow("Error executing Axios Request HTTP 500");
		});

	});

	describe("parseIssueText", () => {
		it("parses valid issue text", () => {
			const inputText = "This is a valid issue text KEY-123 and CAT-999.";
			const expectedKeys = ["KEY-123", "CAT-999"];

			const result = JiraClient.parseIssueText(inputText);

			expect(result).toEqual(expectedKeys);
		});

		it("returns undefined for empty input text", () => {
			const inputText = "";

			const result = JiraClient.parseIssueText(inputText);

			expect(result).toBeUndefined();
		});

		it("returns undefined for undefined input text", () => {
			const inputText = undefined as unknown as string;

			const result = JiraClient.parseIssueText(inputText);

			expect(result).toBeUndefined();
		});

	});

});

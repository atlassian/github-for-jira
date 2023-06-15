import { test, expect } from "@playwright/test";
import { jiraCreateProject, jiraRemoveProject } from "test/e2e/utils/jira";
import { createProjectId, testData } from "test/e2e/constants";

test.describe("Create project", () => {
	test.use({
		storageState: testData.jira.roles.admin.state
	});

	test("Can create project", async ({ page }) => {
		const projectId = createProjectId();
		await jiraCreateProject(page, projectId);
		const response = await page.goto(testData.jira.urls.project(projectId));
		expect(response).toBeTruthy();
		expect(response?.status()).toBe(200);
		await jiraRemoveProject(page, projectId);
	});
});


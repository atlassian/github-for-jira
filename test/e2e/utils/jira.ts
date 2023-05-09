import { Locator, Page } from "@playwright/test";
import { JiraTestDataRoles, testData } from "test/e2e/constants";
import { envVars } from "config/env";

const data = testData.jira;

export const jiraLogin = async (page: Page, roleName: keyof JiraTestDataRoles, saveState = false): Promise<Page> => {
	const role = data.roles[roleName];
	if (!role.username || !role.password) {
		throw "Jira username or password missing";
	}
	await page.goto(data.urls.login);
	await page.waitForLoadState();
	// This is a hack because atlassian auth is all frontend, it shows the login page and form
	// but then redirects to the correct page if the token is available.  However, playwright
	// will continue after the page loads and try to fill in the form before being redirected,
	// causing a flow issue.  This is non-standard for any authentication as it should
	// return a redirect header instead so the page doesn't have to load, then redirect.
	await page.waitForTimeout(500);
	await page.waitForLoadState();
	if (page.url().startsWith(data.urls.auth)) {
		const userinput = page.locator("#username");
		const passinput = page.locator("#password");
		await userinput.fill(role.username);
		await userinput.press("Enter");
		await passinput.fill(role.password);
		await passinput.press("Enter");
		await page.waitForURL(data.urls.yourWork);
	}

	if (saveState && role.state) {
		await page.context().storageState({ path: role.state });
	}

	return page;
};

export const jiraEnsureAppInstalled = async (page: Page): Promise<Page> => {
	if (!await appIsInstalled(page)) {
		await jiraAppInstall(page);
	}

	return page;
};

export const jiraAppInstall = async (page: Page): Promise<Page> => {
	// If app is already installed, uninstall it first
	if (await removeApp(page)) {
		// Need to do this to guarantee that we can install the app right after in marketplace (this is a marketplace bug)
		await page.reload();
		await page.waitForSelector("#upm-manage-plugins-user-installed");
	}

	await page.click("#upm-upload");
	await page.fill("#upm-upload-url", data.urls.connectJson);
	await page.click("#upm-upload-dialog .aui-button-primary");
	await page.click(`#upm-plugin-status-dialog .confirm`, { timeout: 60000 });
	const iframe = await page.frameLocator("#ak-main-content iframe");
	await (await iframe.locator(".jiraConfiguration")).waitFor();
	return page;
};

export const jiraAppUninstall = async (page: Page): Promise<Page> => {
	await page.goto(data.urls.manageApps);
	await removeApp(page);
	return page;
};

export const jiraCreateProject = async (page: Page, projectId: string): Promise<void> => {
	await page.goto(data.urls.projects);
	await page.locator("[data-test-id='global-pages.directories.projects-directory-v2.create-projects-button.button.button']").click();
	await page.locator("[data-testid='project-template-select-v2.ui.layout.category-overview.template-list-card.template-list-button'][aria-label='Kanban']").click();
	await page.locator("[data-testid='project-template-select-v2.ui.layout.screens.template-overview.template-overview-card.use-template-button.button']").click();
	await page.locator("[data-testid='project-template-select-v2.ui.layout.screens.project-types.footer.select-project-button-team-managed']").click();
	await page.fill("[id='project-create.create-form.name-field.input']", projectId);
	await page.fill("[id='project-create.create-form.advanced-dropdown.key-field.input']", projectId);
	await page.locator("[data-test-id='project-create.create-form.create-screen.submit-button']").click();

	// V3 flow for future - apparently our e2e instance is still on v2
	/*await page.locator("[data-testid='global-pages.directories.projects-directory-v3.create-projects-button']").click();
	await page.locator("[data-testid='project-template-select-v2.ui.layout.category-overview.template-list-card.template-list-button']").click();
	await page.locator("[data-testid='project-template-select-v2.ui.layout.screens.template-overview.template-overview-card.use-template-button.button']").click();
	await page.locator("[data-testid='project-template-select-v2.ui.layout.screens.project-types.footer.select-project-button-team-managed']").click();
	await page.fill("[id='project-create.create-form.name-field.input']", projectId);
	await page.locator("[data-testid='project-access.field.button-trigger']").click();
	await page.locator("[data-testid='project-access.field.dropdown-menu--content'] [data-testid='project-access.field.option']").nth(2).click();
	await page.fill("[id='project-create.create-form.advanced-dropdown.key-field.input']", projectId);
	await page.locator("[data-test-id='project-create.create-form.create-screen.submit-button'] button").click();*/
	await page.waitForSelector(":has-text('Jira project successfully created')");
};

export const jiraRemoveProject = async (page: Page, projectId: string): Promise<boolean> => {
	const status = (await page.goto(data.urls.project(projectId)))?.status() || 0;
	if (status == 200) {
		await page.goto(data.urls.projectDetails(projectId));
		await page.locator("[data-testid='project-details.header.menu.dropdown-menu--trigger']").click();
		await page.locator("[data-testid='project-details.header.menu.dropdown-menu--content'] button").click();
		await page.locator("[data-testid='project-soft-delete-modal.ui.move-to-trash-button-wrapper']").click();
		return true;
	}
	return false;
};

export const jiraCreateIssue = async (page: Page, projectId: string = testData.projectId()): Promise<string> => {
	await page.goto(data.urls.project(projectId));

	await page.locator("[data-testid='platform-inline-card-create.ui.trigger.visible.button']").click();
	const taskInput = page.locator("textarea[data-test-id='platform-inline-card-create.ui.form.summary.styled-text-area']");

	// V3 implementation
	// await page.locator("[data-testid='navigation-apps-sidebar-next-gen.ui.menu.software-backlog-link']").click();
	// const taskInput = page.locator("[data-test-id='platform-inline-card-create.ui.form.summary.styled-text-area']");
	await taskInput.fill("Task " + Date.now());
	await taskInput.press("Enter");
	const url = await page.locator("[data-test-id='platform-board-kit.ui.column.draggable-column.styled-wrapper']:first-child [data-test-id='platform-board-kit.ui.card.card'][draggable]").last().getAttribute("id");
	return url?.replace("card-", "") || "";
};

export const jiraRemoveIssue = async (page: Page, issueId: string): Promise<boolean> => {
	const status = (await page.goto(data.urls.browse(issueId)))?.status() || 0;
	if (status == 200) {
		await page.keyboard.press(".");
		await page.locator("section[role='dialog'] input").fill("delete");
		await page.locator("section[role='dialog'] input").press("Enter");
		await page.locator("[data-testid='issue.views.issue-base.foundation.issue-actions.delete-issue.confirm-button']").click();
		return true;
	}
	return false;
};

const appIsInstalled = async (page: Page): Promise<Locator | undefined> => {
	if (!page.url().startsWith(data.urls.manageApps)) {
		await page.goto(data.urls.manageApps);
	}
	await page.waitForSelector("#upm-manage-plugins-user-installed");
	const pluginRow = page.locator(`.upm-plugin[data-key="${envVars.APP_KEY}"]`);
	if (await pluginRow.isVisible()) {
		return pluginRow;
	}
	return undefined;
};

const removeApp = async (page: Page): Promise<boolean> => {
	const pluginRow = await appIsInstalled(page);
	if (pluginRow) {
		await pluginRow.click();
		const uninstallButton = pluginRow.locator(`a[data-action="UNINSTALL"]`);
		await uninstallButton.click();
		await page.click("#upm-confirm-dialog .confirm");
		await uninstallButton.isDisabled();
		return true;
	}
	return false;
};

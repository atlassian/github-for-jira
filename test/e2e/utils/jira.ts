import { Page } from "@playwright/test";
import { JiraTestDataRoles, TEST_PROJECT_KEY, TEST_PROJECT_NAME, testData } from "test/e2e/constants";
import { APP_KEY } from "routes/jira/atlassian-connect/jira-atlassian-connect-get";

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

		if (saveState && role.state) {
			await page.context().storageState({ path: role.state });
		}
	}

	return page;
};

export const jiraAppInstall = async (page: Page): Promise<Page> => {
	await page.goto(data.urls.manageApps);

	// If app is already installed, uninstall it first
	if (await removeApp(page)) {
		// Need to do this to guarantee that we can install the app right after in marketplace (this is a marketplace bug)
		await page.reload();
		await page.waitForSelector("#upm-manage-plugins-user-installed");
	}

	await page.click("#upm-upload");
	await page.fill("#upm-upload-url", data.urls.connectJson);
	await page.click("#upm-upload-dialog .aui-button-primary");
	await page.click(`#upm-plugin-status-dialog .confirm`);
	const iframe = await page.frameLocator("#ak-main-content iframe");
	await (await iframe.locator(".jiraConfiguration")).waitFor();
	return page;
};

export const jiraAppUninstall = async (page: Page): Promise<Page> => {
	await page.goto(data.urls.manageApps);
	await removeApp(page);
	return page;
};

export const jiraAddProject = async (page: Page): Promise<Page> => {
	await page.goto(data.urls.projects);
	await (page.locator("button[data-test-id='global-pages.directories.projects-directory-v2.create-projects-button.button.button']")).click();
	await (page.locator("button[aria-label='Scrum']")).click();
	await (page.locator("button[data-testid='project-template-select-v2.ui.layout.screens.template-overview.template-overview-card.use-template-button.button']")).click();
	await (page.locator("button[data-testid='project-template-select-v2.ui.layout.screens.project-types.footer.select-project-button-team-managed']")).click();
	await page.fill("input[id='project-create.create-form.name-field.input']", TEST_PROJECT_NAME);
	await page.fill("input[id='project-create.create-form.advanced-dropdown.key-field.input']", TEST_PROJECT_KEY);
	await (page.locator("div[data-test-id='project-create.create-form.create-screen.submit-button']")).click();
	// await page.waitForNavigation();
	return page;
};

export const jiraCreateIssue = async (page: Page): Promise<Page> => {
	await page.goto(data.urls.testProjectBrowse);
	await (page.locator("a[data-testid='navigation-apps-sidebar-next-gen.ui.menu.software-backlog-link']")).click();
	const taskInput = page.locator("textarea[data-test-id='platform-inline-card-create.ui.form.summary.styled-text-area']");
	await taskInput.fill("Task " + Date.now());
	await taskInput.press("Enter");

	return page;
};

export const jiraRemoveProject = async (page: Page): Promise<Page> => {
	await page.goto(data.urls.testProjectSettings);
	await (page.locator("button[data-testid='project-details.header.menu.dropdown-menu--trigger']")).click();
	await (page.locator("div[data-testid='project-details.header.menu.dropdown-menu--content'] button[role='menuitem']:first-of-type")).click();
	await (page.locator("button[data-testid='project-soft-delete-modal.ui.move-to-trash-button-wrapper']")).click();

	// Permanently deleting too
	await (page.locator("div[data-testid='project-soft-delete-modal.ui.flags.moved-to-trash-success-actions'] a:first-of-type")).click();
	await (page.locator("button[data-testid='inactive-projects-directory-base.ui.projects-table.body.cells.trash.dropdown--trigger']")).click();
	await (page.locator("div[data-testid='inactive-projects-directory-base.ui.projects-table.body.cells.trash.dropdown--content'] button[role='menuitem']:first-of-type")).click();
	await (page.locator("button[data-test-id='project-permanent-delete-modal.ui.actions.delete-button-wrapper']")).click();

	return page;
};

const removeApp = async (page: Page): Promise<boolean> => {
	await page.waitForSelector("#upm-manage-plugins-user-installed");
	const pluginRow = page.locator(`.upm-plugin[data-key="${APP_KEY}"]`);
	if (await pluginRow.isVisible()) {
		await pluginRow.click();
		const uninstallButton = await pluginRow.locator(`a[data-action="UNINSTALL"]`);
		await uninstallButton.click();
		await page.click("#upm-confirm-dialog .confirm");
		await uninstallButton.isDisabled();
		return true;
	}
	return false;
};

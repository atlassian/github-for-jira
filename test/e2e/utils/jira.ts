import { Page } from "@playwright/test";
import { JiraTestDataRoles, testData } from "test/e2e/constants";
import { APP_KEY } from "routes/jira/jira-atlassian-connect-get";

const data = testData.jira;

export const jiraLogin = async (page: Page, roleName: keyof JiraTestDataRoles): Promise<Page> => {
	const role = data.roles[roleName];
	if (!role.username || !role.password) {
		throw "Jira username or password missing";
	}
	await page.goto(data.urls.login);
	await page.waitForLoadState();
	if (page.url() !== data.urls.yourWork) {
		const userinput = await page.locator("#username");
		const passinput = await page.locator("#password");
		await userinput.fill(role.username);
		await userinput.press("Enter");
		await passinput.fill(role.password);
		await passinput.press("Enter");
		await page.waitForURL(data.urls.yourWork);
	}

	if (role.storage) {
		await page.context().storageState({ path: role.storage });
	}
	return page;
};

export const jiraAppInstall = async (page: Page): Promise<Page> => {
	await jiraLogin(page, "admin");
	await page.goto(data.urls.manageApps);
	await page.waitForSelector("#upm-manage-plugins-user-installed");
	const pluginRow = await page.locator(`.upm-plugin[data-key="${APP_KEY}"] .upm-plugin-row`);
	if (!(await pluginRow.isVisible())) {
		await page.click("#upm-upload");
		await page.fill("#upm-upload-url", data.urls.connectJson);
		await page.click("#upm-upload-dialog .aui-button-primary");
		await page.click(`#upm-plugin-status-dialog .confirm`);
		const iframe = await page.frameLocator("#ak-main-content iframe");
		await (await iframe.locator(".jiraConfiguration")).waitFor({ timeout: 10000 });
	}
	return page;
};

export const jiraAppUninstall = async (page: Page): Promise<Page> => {
	await jiraLogin(page, "admin");
	await page.goto(data.urls.manageApps);
	await page.waitForSelector("#upm-manage-plugins-user-installed");
	const pluginRow = await page.locator(`.upm-plugin[data-key="${APP_KEY}"]`);
	if (await pluginRow.isVisible()) {
		await pluginRow.click();
		await page.pause();
		const uninstallButton = await pluginRow.locator(`a[data-action="UNINSTALL"]`);
		await uninstallButton.click();
		await page.click("#upm-confirm-dialog .confirm");
		await uninstallButton.isDisabled();
	}

	return page;
};

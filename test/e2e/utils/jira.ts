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
	await (await page.locator("#upm-upload")).click();
	await (await page.locator("#upm-upload-url")).fill(data.urls.connectJson);
	await (await page.locator("#upm-upload-dialog .aui-button-primary")).click();
	const getStarted = await page.locator(`#upm-plugin-status-dialog .confirm`);
	// await getStarted.waitFor({ timeout: 30000 });
	await getStarted.click();
	const iframe = await page.frameLocator("#ak-main-content iframe");
	await (await iframe.locator(".jiraConfiguration")).waitFor({ timeout: 10000 });
	return page;
};

export const jiraAppUninstall = async (page: Page): Promise<Page> => {
	await jiraLogin(page, "admin");
	await page.goto(data.urls.manageApps);
	const pluginRow = await page.locator(`.upm-plugin[data-key="${APP_KEY}"] .upm-plugin-row`);
	// await pluginRow.waitFor({ timeout: 30000 });
	await pluginRow.click();
	const uninstallButton = await pluginRow.locator(`[data-action="UNINSTALL"]`);
	await uninstallButton.click();
	await (await page.locator("#upm-confirm-dialog .confirm")).click();
	await uninstallButton.isDisabled();
	return page;
};

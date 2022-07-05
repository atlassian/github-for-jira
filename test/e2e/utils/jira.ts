import { Browser, Page } from "@playwright/test";
import { JiraTestDataRoles, testData } from "test/e2e/constants";

const data = testData.jira;

export const jiraLogin = async (browser: Browser, roleName: keyof JiraTestDataRoles): Promise<Page> => {
	const role = data.roles[roleName];
	if (!role.username || !role.password) {
		throw "JIRA_USERNAME or JIRA_PASSWORD missing from .env.test file";
	}
	const page = await browser.newPage();
	await page.goto(data.urls.login);
	const userinput = await page.locator("#username");
	const passinput = await page.locator("#password");
	await userinput.fill(role.username);
	await userinput.press("Enter");
	await passinput.fill(role.password);
	await passinput.press("Enter");
	await page.waitForNavigation({ url: data.urls.dashboard });
	if (role.storage) {
		await page.context().storageState({ path: role.storage });
	}
	return page;
};

export const jiraAppInstall = async (browser: Browser) => {
	const page = await browser.newPage();
	await page.goto(data.urls.manageApps);
	await (await page.locator("#upm-upload")).click();
	await (await page.locator("#upm-upload-url")).fill(data.urls.connectJson);
	await (await page.locator("#upm-upload-dialog .aui-button-primary")).click();
	const getStarted = await page.locator(`#upm-plugin-status-dialog .confirm`);
	await getStarted.waitFor({ timeout: 30000 });
	await getStarted.click();
	const iframe = await page.frameLocator("#ak-main-content iframe");
	await (await iframe.locator(".jiraConfiguration")).waitFor({ timeout: 10000 });
};

export const jiraAppUninstall = async (browser: Browser) => {

};

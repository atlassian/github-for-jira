import { Browser, Page } from "@playwright/test";
import { JiraTestDataURLs, LoginData } from "test/e2e/constants";

export const jiraLogin = async (browser: Browser, data: LoginData<JiraTestDataURLs>): Promise<Page> => {
	if (!data.username || !data.password) {
		throw "JIRA_USERNAME or JIRA_PASSWORD missing from .env.test file";
	}
	const page = await browser.newPage();
	await page.goto(data.login);
	const userinput = await page.locator("#username");
	const passinput = await page.locator("#password");
	await userinput.fill(data.username);
	await userinput.press("Enter");
	await passinput.fill(data.password);
	await passinput.press("Enter");
	await page.waitForNavigation({ url: data.dashboard });
	if (data.storage) {
		await page.context().storageState({ path: data.storage });
	}
	return page;
};

export const jiraAppInstall = async (browser: Browser) => {

};

export const jiraAppUninstall = async (browser: Browser) => {

};

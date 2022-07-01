import { Browser } from "@playwright/test";
import { LoginData } from "test/e2e/constants";

export const githubLogin = async (browser: Browser, data: LoginData) => {
	if (!data.username || !data.password) {
		throw "github username or github password missing";
	}
	const page = await browser.newPage();
	await page.goto(data.login);
	const userinput = await page.locator("#login_field");
	const passinput = await page.locator("#password");
	await userinput.fill(data.username);
	await userinput.press("Tab");
	await passinput.fill(data.password);
	await passinput.press("Tab");
	await passinput.press("Enter");
	await page.waitForNavigation({ url: data.base });
	if (data.storage) {
		await page.context().storageState({ path: data.storage });
	}
	return page;
};

export const githubAppInstall = async (browser: Browser) => {

};

export const githubAppUninstall = async (browser: Browser) => {

};

import { Browser } from "@playwright/test";
import { GithubTestDataRoles, testData } from "test/e2e/constants";

const data = testData.github;
export const githubLogin = async (browser: Browser, roleName: keyof GithubTestDataRoles) => {
	const role = data.roles[roleName];
	if (!role.username || !role.password) {
		throw "github username or github password missing";
	}
	const page = await browser.newPage();
	await page.goto(data.urls.login);
	const userinput = await page.locator("#login_field");
	const passinput = await page.locator("#password");
	await userinput.fill(role.username);
	await userinput.press("Tab");
	await passinput.fill(role.password);
	await passinput.press("Tab");
	await passinput.press("Enter");
	await page.waitForNavigation({ url: data.urls.base });
	if (role.storage) {
		await page.context().storageState({ path: role.storage });
	}
	return page;
};

export const githubAppInstall = async (browser: Browser) => {

};

export const githubAppUninstall = async (browser: Browser) => {

};

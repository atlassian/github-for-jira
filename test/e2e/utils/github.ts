import { Page } from "@playwright/test";
import { GithubTestDataRoles, testData } from "test/e2e/constants";

const data = testData.github;
export const githubLogin = async (page: Page, roleName: keyof GithubTestDataRoles) => {
	const role = data.roles[roleName];
	if (!role.username || !role.password) {
		throw "github username or github password missing";
	}
	await page.goto(data.urls.login);
	await page.waitForLoadState();
	if (await page.url() !== data.urls.base) {
		const userinput = await page.locator("#login_field");
		const passinput = await page.locator("#password");
		await userinput.fill(role.username);
		await userinput.press("Tab");
		await passinput.fill(role.password);
		await passinput.press("Enter");
		await page.waitForURL(data.urls.base);
	}

	if (role.storage) {
		await page.context().storageState({ path: role.storage });
	}
	return page;
};
/*
export const githubAppInstall = async (page: Page) => {
	await page.goto(data.urls.apps);
};

export const githubAppUninstall = async (page: Page) => {

};*/

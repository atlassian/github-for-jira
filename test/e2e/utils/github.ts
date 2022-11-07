import { Page } from "@playwright/test";
import { GithubTestDataRoles, testData } from "test/e2e/constants";
import { e2eEnvVars } from "test/e2e/env-e2e";
import { totp } from "speakeasy";

const data = testData.github;
export const githubLogin = async (page: Page, roleName: keyof GithubTestDataRoles, saveState = false) => {
	const role = data.roles[roleName];
	if (!role.username || !role.password) {
		throw "github username or github password missing";
	}
	await page.goto(data.urls.login);
	await page.waitForLoadState();
	if (page.url().startsWith(data.urls.login)) {
		const userinput = page.locator("#login_field");
		const passinput = page.locator("#password");
		await userinput.fill(role.username);
		await userinput.press("Tab");
		await passinput.fill(role.password);
		await passinput.press("Enter");
		await page.waitForLoadState();
		if (page.url().startsWith(data.urls.mfa)) {
			await page.fill("#totp", totp({ secret: e2eEnvVars.GITHUB_2FA_SECRET,  encoding: "base32" }));
		}
		await page.waitForURL(data.urls.base);

		if (saveState && role.state) {
			await page.context().storageState({ path: role.state });
		}
	}

	return page;
};

// Updates ngrok URLs in github app
export const githubAppUpdateURLs = async (page: Page) => {
	await page.goto(data.urls.appSettings);
	await page.waitForLoadState();
	await page.fill("#integration_application_callback_urls_attributes_0_url", `${e2eEnvVars.APP_URL}/github/callback`);
	await page.fill("#integration_setup_url", `${e2eEnvVars.APP_URL}/github/callback`);
	await page.fill("#integration_hook_attributes_url", `${e2eEnvVars.APP_URL}/github/events`);
	await page.click(`input[name="commit"]`);
	await page.waitForLoadState();
};

export const githubCreateRepository = async (page: Page) => {
	// TODO: add github app install
	await page.goto(data.urls.apps);
};

export const githubDeleteRepository = async (page: Page) => {
	// TODO: add github app install
	await page.goto(data.urls.apps);
};

export const githubCreateApp = async (page: Page) => {
	// TODO: add github app install
	await page.goto(data.urls.apps);
};

export const githubDeleteApp = async (page: Page) => {
	// TODO: add github app install
	await page.goto(data.urls.apps);
};

export const githubAppInstall = async (page: Page) => {
	// TODO: add github app install
	await page.goto(data.urls.apps);
};

export const githubAppUninstall = async (page: Page) => {
	// TODO: add github app uninstall
	await page.goto(data.urls.apps);
};

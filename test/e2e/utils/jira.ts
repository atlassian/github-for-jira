import { Page } from "@playwright/test";
import { JiraTestDataRoles, testData } from "test/e2e/constants";
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

import { Installation } from "models/installation";
import { Express } from "express";
import { Server } from "http";
import { Browser, chromium, Page } from "playwright";
import { getFrontendApp } from "~/src/app";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import { getLogger } from "config/logger";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { GitHubServerApp } from "models/github-server-app";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import path from "path";

jest.setTimeout(20000);

jest.mock("config/feature-flags");

declare global {
	interface Window {
		AP: {
			context: {
				getToken: (callack: (string) => void) => void
			},
			navigator: {
				go: (arg1: any, arg2: any) => void
			}
		}
	}
}

describe("jira-connect-enterprise-get.frontend(jira-server-url.hbs + jira-server-url.js)", () => {
	let installation: Installation;
	let gitHubServerApp: GitHubServerApp;

	let app: Express;
	const port = 3000;
	let server: Server;
	let browser: Browser;
	let page: Page;

	beforeAll(async () => {
		app = getFrontendApp();
		server = app.listen(port);

		const options = {
			headless: false, slowMo: 100  // uncomment for debugging
		};
		browser = await chromium.launch(options);
		page = await browser.newPage();
	});

	afterAll(async () => {
		await browser.close();

		server.close();
	});

	beforeEach(async () => {
		const result = await (new DatabaseStateCreator()).forServer().create();
		installation = result.installation;
		gitHubServerApp = result.gitHubServerApp!;
	});

	const generateJwt = async (query: any = {}) => {
		return encodeSymmetric({
			qsh: createQueryStringHash({
				method: "GET",
				pathname: `/jira/connect/enterprise/${gitHubServerApp.uuid}/app/new`,
				query
			}, false),
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	const submitForm = async () =>
		page.click("#Next");

	const getInputError = async (eltId: string) => {
		return await page.$eval(`#${eltId}`, (el) => {
			const nextElement = el.nextElementSibling;
			return nextElement ? nextElement.innerHTML : null;
		});
	};

	const getAppNameInputError = () => getInputError("gitHubAppNameInput");

	const getApiKeyHeaderNameInputError = () => getInputError("apiKeyHeaderName");

	const getApiKeyValueInputError = () => getInputError("apiKeyValue");

	const focusAndEnterInputValue = async (eltId: string, value: string) => {
		await page.focus(`#${eltId}`);
		await page.fill(`#${eltId}`, value);
		await page.keyboard.up("Enter");
	};

	const enterApiKeyHeaderName = (name) => focusAndEnterInputValue("apiKeyHeaderName", name);

	const enterAppName = (name) => focusAndEnterInputValue("gitHubAppNameInput", name);

	const enterAppId = (id) => focusAndEnterInputValue("appId", id);

	const enterWebhookSecret = (secret) => focusAndEnterInputValue("webhookSecret", secret);

	const enterClientId = (clientId) => focusAndEnterInputValue("gitHubClientId", clientId);

	const enterClientSecret = (clientSecret) => focusAndEnterInputValue("gitHubClientSecret", clientSecret);

	const enterApiKeyValue = (value) => focusAndEnterInputValue("apiKeyValue", value);

	const uploadPrivateKey = async (filePath) => {
		const fileInput = (await page.$("#privateKeyFile"))!;
		await fileInput.setInputFiles(filePath);
	};

	it.each([true, false])("when FF %s validates github app name", async (flagValue) => {
		when(booleanFlag).calledWith(
			BooleanFlags.ENABLE_API_KEY_FEATURE,
			jiraHost
		).mockResolvedValue(flagValue);

		await page.goto(`http://localhost:3000/jira/connect/enterprise/${gitHubServerApp.uuid}/app/new?jwt=${await generateJwt()}`);
		expect(await getAppNameInputError()).toBeNull();

		await submitForm();

		expect(await getAppNameInputError()).toStrictEqual(`<ul><li><span class="aui-icon aui-icon-small aui-iconfont-error aui-icon-notification">This is a required field</span>This is a required field</li></ul>`);
	});

	const mockAp = async () => {
		await page.evaluate(
			(jwt) => {
				window.AP = window.AP || {};
				window.AP.context = window.AP.context || {};
				window.AP.context.getToken = (callback) => {
					callback(jwt);
				};
				window.AP.navigator = window.AP.navigator || {};
				window.AP.navigator.go = (arg1, arg2) => {
					window["redirectData"] = {
						arg1, arg2
					};
				};
			},
			encodeSymmetric({
				qsh: "context-qsh",
				iss: installation.plainClientKey
			}, await installation.decrypt("encryptedSharedSecret", getLogger("test")))
		);
	};

	describe("with FF ON", () => {
		beforeEach(async () => {
			when(booleanFlag).calledWith(
				BooleanFlags.ENABLE_API_KEY_FEATURE,
				jiraHost
			).mockResolvedValue(true);

			await page.goto(`http://localhost:3000/jira/connect/enterprise/${gitHubServerApp.uuid}/app/new?jwt=${await generateJwt()}`);

			await mockAp();
		});

		it("known HTTP headers cannot be used as an API key header", async () => {
			expect(await getApiKeyHeaderNameInputError()).toBeNull();
			await enterApiKeyHeaderName("authorization");

			await submitForm();

			expect(await getApiKeyHeaderNameInputError()).toStrictEqual("<ul><li><span class=\"aui-icon aui-icon-small aui-iconfont-error aui-icon-notification\">authorization is a reserved string and cannot be used.</span>authorization is a reserved string and cannot be used.</li></ul>");
		});

		it("API key value cannot be used without API key header", async () => {
			expect(await getApiKeyValueInputError()).toBeNull();
			await enterApiKeyHeaderName("x-foo");

			await submitForm();

			expect(await getApiKeyValueInputError()).toStrictEqual("<ul><li><span class=\"aui-icon aui-icon-small aui-iconfont-error aui-icon-notification\">Cannot be empty.</span>Cannot be empty.</li></ul>");
		});

		it("submits data and creates the page", async () => {
			await enterAppName("foo");
			await enterWebhookSecret("myWebhookSecret");
			await enterAppId("12321");
			await enterClientId("myclientid");
			await enterClientSecret("myclientsecret");
			await enterApiKeyHeaderName("x-foo");
			await enterApiKeyValue("myapikey");
			await uploadPrivateKey(path.resolve(__dirname, "../../../../../../test/setup/test-key.pem"));

			await submitForm();

			const childWindow = (await new Promise(resolve => page.once("popup", resolve)))!;
			const childWindowUrl = (childWindow as any).url();

			const apps = await GitHubServerApp.findAll({ where: { installationId: installation.id } });
			const newApp = apps.filter(app => app.uuid !== gitHubServerApp.uuid)[0];

			expect(childWindowUrl).toStrictEqual(`http://localhost:3000/session/github/${newApp.uuid}/configuration?ghRedirect=to`);
			expect(newApp.apiKeyHeaderName).toStrictEqual("x-foo");
			expect(newApp.encryptedApiKeyValue).toStrictEqual("encrypted:myapikey");
		});
	});

	// TODO: delete when FF is removed
	describe("with FF OFF", () => {
		it("submits data", async () => {
			await enterAppName("foo");
			await enterWebhookSecret("myWebhookSecret");
			await enterAppId("12321");
			await enterClientId("myclientid");
			await enterClientSecret("myclientsecret");
			await uploadPrivateKey(path.resolve(__dirname, "../../../../../../test/setup/test-key.pem"));

			await submitForm();

			const childWindow = (await new Promise(resolve => page.once("popup", resolve)))!;
			const childWindowUrl = (childWindow as any).url();

			const apps = await GitHubServerApp.findAll({ where: { installationId: installation.id } });
			const newApp = apps.filter(app => app.uuid !== gitHubServerApp.uuid)[0];

			expect(childWindowUrl).toStrictEqual(`http://localhost:3000/session/github/${newApp.uuid}/configuration?ghRedirect=to`);
		});
	});


});

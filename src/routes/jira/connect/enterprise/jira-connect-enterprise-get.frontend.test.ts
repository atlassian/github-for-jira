import { chromium, Browser, Page } from "playwright";
import { getFrontendApp } from "~/src/app";
import { Server } from "http";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { Installation } from "models/installation";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import { getLogger } from "config/logger";
import { Express } from "express";
import { GheConnectConfigTempStorage } from "utils/ghe-connect-config-temp-storage";

jest.setTimeout(10000);

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

describe("jira-connect-enterprise-get.frontend", () => {
	let installation: Installation;

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

	beforeEach(async () => {
		const result = await (new DatabaseStateCreator()).create();
		installation = result.installation;
	});

	const generateJwt = async (query: any = {}) => {
		return encodeSymmetric({
			qsh: createQueryStringHash({
				method: "GET",
				pathname: "/jira/connect/enterprise",
				query
			}, false),
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	beforeEach(async () => {
		await page.goto("http://localhost:3000/jira/connect/enterprise?new=true&jwt=" + await generateJwt({
			new: "true"
		}));
	});

	const expectErrorMessageAndDisabledButton = async (errorMessage: string) => {
		await page.waitForFunction(
			`document.querySelector("body").innerText.includes("${errorMessage}")`,
			{ timeout: 5000 }
		);
		const disabledValue = await page.$eval("#gheServerBtn", (element) => element.getAttribute("disabled"));
		expect(disabledValue).toStrictEqual("disabled");
	};

	const enterApiKeyHeaderName = async (name) => {
		await page.focus("#gheApiKeyHeader");
		await page.fill("#gheApiKeyHeader", name);
		await page.keyboard.up("Enter");
	};

	const enterApiKeyHeaderValue = async (value) => {
		await page.focus("#gheApiKeyValue");
		await page.fill("#gheApiKeyValue", value);
		await page.keyboard.up("Enter");
	};

	const enterServerUrl = async (url) => {
		await page.focus("#gheServerURL");
		await page.fill("#gheServerURL", url);
		await page.keyboard.up("Enter");
	};

	const submitForm = async () =>
		page.click("#gheServerBtnText");

	describe("validates API Key header", () => {

		it("when the value is a known HTTP header", async () => {
			await enterApiKeyHeaderName("authorization");

			await expectErrorMessageAndDisabledButton("authorization is a reserved string and cannot be used.");
		});

		it("when the value is too long", async () => {
			await enterApiKeyHeaderName(Array.from({ length: 1200 }, () => "x").join(""));

			await expectErrorMessageAndDisabledButton("Max length is 1,024 characters.");
		});
	});

	describe("validates API Key value", () => {
		beforeEach(async () => {
			await page.goto("http://localhost:3000/jira/connect/enterprise?new=true&jwt=" + await generateJwt({
				new: "true"
			}));
			await enterApiKeyHeaderName("foo");
		});

		it("when the value is empty", async () => {
			await enterApiKeyHeaderValue("   ");

			await expectErrorMessageAndDisabledButton("Cannot be empty.");
		});

		it("when the value is too long", async () => {
			await enterApiKeyHeaderValue(Array.from({ length: 12000 }, () => "x").join(""));

			await expectErrorMessageAndDisabledButton("Max length is 8,096 characters.");
		});

		it("when API header name is not provided", async () => {
			await enterApiKeyHeaderName("");
			await enterApiKeyHeaderValue("some-correct-value");

			await expectErrorMessageAndDisabledButton("Cannot be used without HTTP header name.");
		});
	});

	describe("submits API Key header/value to server", () => {
		beforeEach(async () => {
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
		});

		const waitAndGetRedirectData = async () => {
			await page.waitForFunction(() => window["redirectData"] !== undefined, { timeout: 5000 });

			const redirectData = await page.evaluate(() => {
				return window["redirectData"];
			});
			return redirectData;
		};

		it("OK without API key", async () => {
			gheNock.get("/api/v3/rate_limit")
				.reply(401, { }, { "server": "GitHub.com" });

			await enterServerUrl(gheUrl);

			await submitForm();

			const redirectData = await waitAndGetRedirectData();
			expect(redirectData).toStrictEqual({
				arg1: "addonmodule",
				arg2: {
					moduleKey: "github-app-creation-page",
					customData: {
						connectConfigUuid: expect.anything(),
						serverUrl: expect.anything(),
						new: 1
					}
				}
			});
			expect(await new GheConnectConfigTempStorage().get(redirectData.arg2.customData.connectConfigUuid, installation.id)).toStrictEqual({
				serverUrl: gheUrl,
				apiKeyHeaderName: null,
				encryptedApiKeyValue: null
			});
		});

		it("OK with API key", async () => {
			gheNock.get("/api/v3/rate_limit")
				.matchHeader("OK-HEADER", "foo")
				.reply(401, { }, { "server": "GitHub.com" });

			await enterServerUrl(gheUrl);
			await enterApiKeyHeaderName("OK-HEADER");
			await enterApiKeyHeaderValue(" foo");

			await page.click("#gheServerBtnText");

			const redirectData = await waitAndGetRedirectData();

			expect(redirectData).toStrictEqual({
				arg1: "addonmodule",
				arg2: {
					moduleKey: "github-app-creation-page",
					customData: {
						connectConfigUuid: expect.anything(),
						serverUrl: expect.anything(),
						new: 1
					}
				}
			});
			expect(await new GheConnectConfigTempStorage().get(redirectData.arg2.customData.connectConfigUuid, installation.id)).toStrictEqual({
				serverUrl: gheUrl,
				apiKeyHeaderName: "OK-HEADER",
				encryptedApiKeyValue: "encrypted:foo"
			});
		});
	});

	afterAll(async () => {
		await browser.close();

		server.close();
	});
});

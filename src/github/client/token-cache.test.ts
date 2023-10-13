import { InstallationTokenCache } from "./installation-token-cache";
import { AuthToken, TEN_MINUTES } from "./auth-token";
import { AppTokenHolder } from "./app-token-holder";
import { getInstallationId } from "./installation-id";
import { keyLocator } from "./key-locator";
import { mocked } from "jest-mock";
import { Subscription } from "~/src/models/subscription";
import { envVars } from "config/env";
import fs from "fs";
import path from "path";

jest.mock("./key-locator");
jest.mock("~/src/config/feature-flags");

describe("InstallationTokenCache & AppTokenHolder", () => {
	const githubInstallationId = 123456;
	const date = new Date(2021, 10, 25, 10, 0);
	const in10Minutes = new Date(date.getTime() + TEN_MINUTES);

	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("should not cache any tokens when testing InstallationTokenCache", async () => {
		const installationTokenCache = new InstallationTokenCache();
		const initialInstallationToken = new AuthToken("initial installation token", in10Minutes);
		const generateInitialInstallationToken = jest.fn().mockImplementation(() => Promise.resolve(initialInstallationToken));

		jest.setSystemTime(date);
		const token1 = await installationTokenCache.getInstallationToken(githubInstallationId, undefined, generateInitialInstallationToken);
		const token2 = await installationTokenCache.getInstallationToken(githubInstallationId, undefined, generateInitialInstallationToken);
		expect(token1).toEqual(initialInstallationToken);
		expect(token2).toEqual(initialInstallationToken);
		expect(generateInitialInstallationToken).toHaveBeenCalledTimes(2);
	});

	it("should not cache any tokens when testing AppTokenHolder", async () => {
		mocked(keyLocator).mockImplementation(async () => {
			return fs.readFileSync(path.resolve(process.cwd(), envVars.PRIVATE_KEY_PATH)).toString();
		});
		await Subscription.install({
			host: "http://github.com",
			installationId: 1234,
			hashedClientKey: "client-key",
			gitHubAppId: undefined
		});

		await Subscription.install({
			host: "http://github.com",
			installationId: 4711,
			hashedClientKey: "client-key",
			gitHubAppId: undefined
		});

		const appTokenHolder = new AppTokenHolder();
		jest.setSystemTime(new Date(2021, 10, 25, 10, 0));
		const token1 = await appTokenHolder.getAppToken(getInstallationId(1234), jiraHost);
		expect(token1).toBeTruthy();
		const token2 = await appTokenHolder.getAppToken(getInstallationId(4711), jiraHost);
		expect(token2).toBeTruthy();
		const token3 = await appTokenHolder.getAppToken(getInstallationId(4711), jiraHost, 1);
		expect(token3).toBeTruthy();
		expect(keyLocator).toHaveBeenCalledTimes(3);
	});
});

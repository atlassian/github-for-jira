import { InstallationTokenCache } from "./installation-token-cache";
import { AuthToken, TEN_MINUTES } from "./auth-token";
import { AppTokenHolder } from "./app-token-holder";
import { getInstallationId } from "./installation-id";
import { keyLocator } from "./key-locator";
import { mocked } from "ts-jest/utils";
import { Subscription } from "~/src/models/subscription";

jest.mock("./key-locator");
jest.mock("~/src/config/feature-flags");

describe("InstallationTokenCache & AppTokenHolder", () => {
	const githubInstallationId = 123456;
	const date = new Date(2021, 10, 25, 10, 0);
	const in10Minutes = new Date(date.getTime() + TEN_MINUTES);

	beforeEach(() => {
		jest.useFakeTimers("modern");
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("should not cache any tokens when testing InstallationTokenCache", async () => {
		const installationTokenCache = new InstallationTokenCache();
		const initialInstallationToken = new AuthToken("initial installation token", in10Minutes);
		const generateInitialInstallationToken = jest.fn().mockImplementation(() => Promise.resolve(initialInstallationToken));

		jest.setSystemTime(date);
		const token1 = await installationTokenCache.getInstallationToken(githubInstallationId, generateInitialInstallationToken);
		const token2 = await installationTokenCache.getInstallationToken(githubInstallationId, generateInitialInstallationToken);
		expect(token1).toEqual(initialInstallationToken);
		expect(token2).toEqual(initialInstallationToken);
		expect(generateInitialInstallationToken).toHaveBeenCalledTimes(2);
	});

	it("should not cache any tokens when testing AppTokenHolder", async () => {
		mocked(keyLocator).mockImplementation(async () => await keyLocator(undefined))
		await Subscription.install({
			host: "http://github.com",
			installationId: 1234,
			clientKey: "client-key",
			gitHubAppId: undefined
		});

		await Subscription.install({
			host: "http://github.com",
			installationId: 4711,
			clientKey: "client-key",
			gitHubAppId: undefined
		});

		const appTokenHolder = new AppTokenHolder();
		jest.setSystemTime(new Date(2021, 10, 25, 10, 0));
		const token1 = await appTokenHolder.getAppToken(getInstallationId(1234));
		expect(token1).toBeTruthy();
		const token2 = await appTokenHolder.getAppToken(getInstallationId(4711));
		expect(token2).toBeTruthy();
		const token3 = await appTokenHolder.getAppToken(getInstallationId(4711), 1);
		expect(token3).toBeTruthy();
		expect(keyLocator).toHaveBeenCalledTimes(1);
	});
});

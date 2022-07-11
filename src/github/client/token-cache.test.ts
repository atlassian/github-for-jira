import { InstallationTokenCache } from "./installation-token-cache";
import { AuthToken, TEN_MINUTES } from "./auth-token";
import * as PrivateKey from "probot/lib/private-key";
import { AppTokenHolder } from "./app-token-holder";
import { getInstallationId } from "./installation-id";

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
		const keyLocator = jest.fn().mockReturnValue(PrivateKey.findPrivateKey());
		const appTokenHolder = new AppTokenHolder(keyLocator);

		jest.setSystemTime(new Date(2021, 10, 25, 10, 0));
		const token1 = await appTokenHolder.getAppToken(getInstallationId(4711));
		expect(token1).toBeTruthy();
		const token2 = await appTokenHolder.getAppToken(getInstallationId(4711));
		expect(token2).toBeTruthy();
		expect(keyLocator).toHaveBeenCalledTimes(2);
	});
});

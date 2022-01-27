import InstallationTokenCache from "../../../src/github/client/installation-token-cache";
import AuthToken, { ONE_MINUTE, TEN_MINUTES } from "../../../src/github/client/auth-token";
jest.unmock("lru-cache");

describe("InstallationTokenCache", () => {
	const githubInstallationId = 123456;
	const date = new Date(2021, 10, 25, 10, 0);
	const in5Minutes = new Date(date.getTime() + 5 * ONE_MINUTE);
	const in10Minutes = new Date(date.getTime() + TEN_MINUTES);
	const in20Minutes = new Date(date.getTime() + 2 * TEN_MINUTES);

	it("Re-generates expired tokens", async () => {
		const installationTokenCache = new InstallationTokenCache();
		const initialInstallationToken = new AuthToken("initial installation token", in10Minutes);
		const generateInitialInstallationToken = jest.fn().mockImplementation(() => Promise.resolve(initialInstallationToken));

		const freshInstallationToken = new AuthToken("fresh installation token", in20Minutes);
		const generateFreshInstallationToken = jest.fn().mockImplementation(() => Promise.resolve(freshInstallationToken));

		// TODO: use jest.useFakeTimers
		mockSystemTime(date);
		const token1 = await installationTokenCache.getInstallationToken(githubInstallationId, generateInitialInstallationToken);
		expect(token1).toEqual(initialInstallationToken);
		expect(generateInitialInstallationToken).toHaveBeenCalledTimes(1);
		expect(generateFreshInstallationToken).toHaveBeenCalledTimes(0);

		// after 5 minutes we still expect the same token because it's still valid
		mockSystemTime(in5Minutes);
		const token2 = await installationTokenCache.getInstallationToken(githubInstallationId, generateFreshInstallationToken);
		expect(token2).toEqual(initialInstallationToken);
		expect(generateInitialInstallationToken).toHaveBeenCalledTimes(1);
		expect(generateFreshInstallationToken).toHaveBeenCalledTimes(0);

		// after 10 minutes we expect a new token because the old one has expired
		mockSystemTime(in10Minutes);
		const token3 = await installationTokenCache.getInstallationToken(githubInstallationId, generateFreshInstallationToken);
		expect(token3).toEqual(freshInstallationToken);
		expect(generateInitialInstallationToken).toHaveBeenCalledTimes(1);
		expect(generateFreshInstallationToken).toHaveBeenCalledTimes(1);
	});
});

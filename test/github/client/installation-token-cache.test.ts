import InstallationTokenCache from "../../../src/github/client/installation-token-cache";
import AuthToken, { ONE_MINUTE, TEN_MINUTES } from "../../../src/github/client/auth-token";

describe("InstallationTokenCache", () => {

	const now = new Date(2021, 10, 25, 10, 0);
	const in5Minutes = new Date(now.getTime() + 5 * ONE_MINUTE);
	const in10Minutes = new Date(now.getTime() + TEN_MINUTES);
	const in20Minutes = new Date(now.getTime() + 2 * TEN_MINUTES);

	beforeAll(() => {
		jest.useFakeTimers("modern");
	});

	afterAll(() => {
		jest.useRealTimers();
	})

	it("Re-generates expired tokens", async () => {
		const initialInstallationToken = new AuthToken("initial installation token", in10Minutes);
		const generateInitialInstallationToken = jest.fn().mockImplementation(() => Promise.resolve(initialInstallationToken));

		const freshInstallationToken = new AuthToken("fresh installation token", in20Minutes);
		const generateFreshInstallationToken = jest.fn().mockImplementation(() => Promise.resolve(freshInstallationToken));

		const githubInstallationId = 123456;
		const installationTokenCache = new InstallationTokenCache(1000);

		jest.setSystemTime(now);
		const token1 = await installationTokenCache.getInstallationToken(githubInstallationId, generateInitialInstallationToken)
		expect(token1).toEqual(initialInstallationToken);
		expect(generateInitialInstallationToken).toHaveBeenCalledTimes(1);
		expect(generateFreshInstallationToken).toHaveBeenCalledTimes(0);

		// after 5 minutes we still expect the same token because it's still valid
		jest.setSystemTime(in5Minutes);
		const token2 = await installationTokenCache.getInstallationToken(githubInstallationId, generateFreshInstallationToken)
		expect(token2).toEqual(initialInstallationToken);
		expect(generateInitialInstallationToken).toHaveBeenCalledTimes(1);
		expect(generateFreshInstallationToken).toHaveBeenCalledTimes(0);

		// after 10 minutes we expect a new token because the old one has expired
		jest.setSystemTime(in10Minutes);
		const token3 = await installationTokenCache.getInstallationToken(githubInstallationId, generateFreshInstallationToken)
		expect(token3).toEqual(freshInstallationToken);
		expect(generateInitialInstallationToken).toHaveBeenCalledTimes(1);
		expect(generateFreshInstallationToken).toHaveBeenCalledTimes(1);
	});

});

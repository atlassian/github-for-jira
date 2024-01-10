import { InstallationTokenCache } from "./installation-token-cache";
import { AuthToken, ONE_MINUTE, NINE_MINUTES_MSEC } from "./auth-token";

jest.unmock("lru-cache");

describe("InstallationTokenCache", () => {

	const now = new Date(2021, 10, 25, 10, 0);
	const in5Minutes = new Date(now.getTime() + 5 * ONE_MINUTE);
	const in9Minutes = new Date(now.getTime() + NINE_MINUTES_MSEC);
	const in18Minutes = new Date(now.getTime() + 2 * NINE_MINUTES_MSEC);

	beforeAll(() => {
		jest.useFakeTimers("modern");
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	it("Reuse same token for cloud installation", async () => {

		const GITHUB_INSTALLATION_ID = 1;
		jest.setSystemTime(now);
		const token1 = new AuthToken("token1", in9Minutes);
		const token2 = new AuthToken("token2", in9Minutes);

		const cache1 = InstallationTokenCache.getInstance();
		const cache2 = InstallationTokenCache.getInstance();

		const foundToken1 = await cache1.getInstallationToken(GITHUB_INSTALLATION_ID, undefined, () => Promise.resolve(token1));
		const foundToken2 = await cache2.getInstallationToken(GITHUB_INSTALLATION_ID, undefined, () => Promise.resolve(token2));

		expect(foundToken1).toEqual(foundToken2);

	});

	it("Reuse same token for GHE installation", async () => {

		const GITHUB_INSTALLATION_ID = 1;
		const GITHUB_APP_ID = 1;
		jest.setSystemTime(now);
		const token1 = new AuthToken("token1", in9Minutes);
		const token2 = new AuthToken("token2", in9Minutes);

		const cache1 = InstallationTokenCache.getInstance();
		const cache2 = InstallationTokenCache.getInstance();

		const foundToken1 = await cache1.getInstallationToken(GITHUB_INSTALLATION_ID, GITHUB_APP_ID, () => Promise.resolve(token1));
		const foundToken2 = await cache2.getInstallationToken(GITHUB_INSTALLATION_ID, GITHUB_APP_ID, () => Promise.resolve(token2));

		expect(foundToken1).toEqual(foundToken2);

	});

	it("won't have conflicts on the token for cloud installations", async () => {

		const GITHUB_INSTALLATION_ID_1 = 21;
		const GITHUB_INSTALLATION_ID_2 = 22;
		jest.setSystemTime(now);
		const token1 = new AuthToken("token1", in9Minutes);
		const token2 = new AuthToken("token2", in9Minutes);

		const cache1 = InstallationTokenCache.getInstance();
		const cache2 = InstallationTokenCache.getInstance();

		const foundToken1 = await cache1.getInstallationToken(GITHUB_INSTALLATION_ID_1, undefined, () => Promise.resolve(token1));
		const foundToken2 = await cache2.getInstallationToken(GITHUB_INSTALLATION_ID_2, undefined, () => Promise.resolve(token2));

		expect(foundToken1).not.toEqual(foundToken2);

	});

	it("won't have conflicts on the token for different GHE installations", async () => {

		const CONFLICTIN_GITHUB_INSTALLATION_ID = 31;
		const GITHUB_APP_ID_1 = 31;
		const GITHUB_APP_ID_2 = 32;
		jest.setSystemTime(now);
		const token1 = new AuthToken("token1", in9Minutes);
		const token2 = new AuthToken("token2", in9Minutes);

		const cache1 = InstallationTokenCache.getInstance();
		const cache2 = InstallationTokenCache.getInstance();

		const foundToken1 = await cache1.getInstallationToken(CONFLICTIN_GITHUB_INSTALLATION_ID, GITHUB_APP_ID_1, () => Promise.resolve(token1));
		const foundToken2 = await cache2.getInstallationToken(CONFLICTIN_GITHUB_INSTALLATION_ID, GITHUB_APP_ID_2, () => Promise.resolve(token2));

		expect(foundToken1).not.toEqual(foundToken2);

	});

	it("won't have conflicts on the token for different cloud and GHE installations", async () => {

		const CONFLICTIN_GITHUB_INSTALLATION_ID = 41;
		const GITHUB_APP_ID = 41;
		jest.setSystemTime(now);
		const token1 = new AuthToken("token1", in9Minutes);
		const token2 = new AuthToken("token2", in9Minutes);

		const cache1 = InstallationTokenCache.getInstance();
		const cache2 = InstallationTokenCache.getInstance();

		const foundToken1 = await cache1.getInstallationToken(CONFLICTIN_GITHUB_INSTALLATION_ID, undefined, () => Promise.resolve(token1));
		const foundToken2 = await cache2.getInstallationToken(CONFLICTIN_GITHUB_INSTALLATION_ID, GITHUB_APP_ID, () => Promise.resolve(token2));

		expect(foundToken1).not.toEqual(foundToken2);

	});

	it("Re-generates expired tokens", async () => {
		const initialInstallationToken = new AuthToken("initial installation token", in9Minutes);
		const generateInitialInstallationToken = jest.fn().mockImplementation(() => Promise.resolve(initialInstallationToken));

		const freshInstallationToken = new AuthToken("fresh installation token", in18Minutes);
		const generateFreshInstallationToken = jest.fn().mockImplementation(() => Promise.resolve(freshInstallationToken));

		const githubInstallationId = 123456;
		const installationTokenCache = new InstallationTokenCache();

		jest.setSystemTime(now);
		const token1 = await installationTokenCache.getInstallationToken(githubInstallationId, undefined, generateInitialInstallationToken);
		expect(token1).toEqual(initialInstallationToken);
		expect(generateInitialInstallationToken).toHaveBeenCalledTimes(1);
		expect(generateFreshInstallationToken).toHaveBeenCalledTimes(0);

		// after 5 minutes we still expect the same token because it's still valid
		jest.setSystemTime(in5Minutes);
		const token2 = await installationTokenCache.getInstallationToken(githubInstallationId, undefined, generateFreshInstallationToken);
		expect(token2).toEqual(initialInstallationToken);
		expect(generateInitialInstallationToken).toHaveBeenCalledTimes(1);
		expect(generateFreshInstallationToken).toHaveBeenCalledTimes(0);

		// after 10 minutes we expect a new token because the old one has expired
		jest.setSystemTime(in9Minutes);
		const token3 = await installationTokenCache.getInstallationToken(githubInstallationId, undefined, generateFreshInstallationToken);
		expect(token3).toEqual(freshInstallationToken);
		expect(generateInitialInstallationToken).toHaveBeenCalledTimes(1);
		expect(generateFreshInstallationToken).toHaveBeenCalledTimes(1);
	});

});

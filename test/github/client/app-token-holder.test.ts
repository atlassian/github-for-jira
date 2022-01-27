import AppTokenHolder from "../../../src/github/client/app-token-holder";
import { getCloudInstallationId } from "../../../src/github/client/installation-id";
jest.unmock("lru-cache");

describe("AppTokenHolder", () => {

	it("Re-generates expired tokens", async () => {
		// Re-enable lru-cache as we're testing caching
		const appTokenHolder = new AppTokenHolder();

		// TODO: use jest.useFakeTimers()
		mockSystemTime(new Date(2021, 10, 25, 10, 0));
		const token1 = appTokenHolder.getAppToken(getCloudInstallationId(4711));
		expect(token1).toBeTruthy();

		// after 5 minutes we still expect the same token because it's still valid
		mockSystemTime(new Date(2021, 10, 25, 10, 5));
		const token2 = appTokenHolder.getAppToken(getCloudInstallationId(4711));
		expect(token2).toEqual(token1);

		// after 10 minutes we expect a new token because the old one has expired
		mockSystemTime(new Date(2021, 10, 25, 10, 10));
		const token3 = appTokenHolder.getAppToken(getCloudInstallationId(4711));
		expect(token3).not.toEqual(token1);
	});
});

import AppTokenCache from "../../../src/github/client/app-token-cache";
import fs from "fs";

describe("AppTokenCache", () => {

	const privateKey = fs.readFileSync("./test/github/client/dummy.key", "utf-8");

	beforeAll(() => {
		jest.useFakeTimers("modern");
	});

	afterAll(() => {
		jest.useRealTimers();
	})

	it("Re-generates expired tokens", async () => {
		const appTokenCache = new AppTokenCache(privateKey, "42");

		jest.setSystemTime(new Date(2021, 10, 25, 10, 0));
		const token1 = appTokenCache.getAppToken();
		expect(token1).toBeTruthy();

		// after 5 minutes we still expect the same token because it's still valid
		jest.setSystemTime(new Date(2021, 10, 25, 10, 5));
		const token2 = appTokenCache.getAppToken();
		expect(token2).toEqual(token1);

		// after 10 minutes we expect a new token because the old one has expired
		jest.setSystemTime(new Date(2021, 10, 25, 10, 10));
		const token3 = appTokenCache.getAppToken();
		expect(token3).not.toEqual(token1);
	});

});

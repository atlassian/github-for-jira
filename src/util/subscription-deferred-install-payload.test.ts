import { extractParsedPayload, SubscriptionDeferredInstallPayload } from "utils/subscription-deferred-install-payload";
import { Request } from "express";

describe("extractParsedPayload", () => {
	it("decrypt parses the payload from request", async () => {
		expect(await extractParsedPayload({
			params: {
				payload: "encrypted:" + JSON.stringify({
					installationIdPk: 1,
					orgName: "myOgName",
					gitHubInstallationId: 2
				} as SubscriptionDeferredInstallPayload)
			}
		} as unknown as Request)).toStrictEqual({
			installationIdPk: 1,
			orgName: "myOgName",
			gitHubInstallationId: 2
		});
	});

	it("throws an exception when payload is invalid", async () => {
		await expect(extractParsedPayload({
			params: {
				payload: "foo"
			}
		} as unknown as Request)).toReject();
	});
});

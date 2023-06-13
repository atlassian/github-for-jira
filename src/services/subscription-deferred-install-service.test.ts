import { extractSubscriptionDeferredInstallPayload, SubscriptionDeferredInstallPayload } from "services/subscription-deferred-install-service";
import { Request } from "express";

describe("extractParsedPayload", () => {
	it("decrypt parses the payload from request", async () => {
		expect(await extractSubscriptionDeferredInstallPayload({
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
		await expect(extractSubscriptionDeferredInstallPayload({
			params: {
				payload: "foo"
			}
		} as unknown as Request)).toReject();
	});
});

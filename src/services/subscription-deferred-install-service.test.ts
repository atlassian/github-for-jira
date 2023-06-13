import {
	extractSubscriptionDeferredInstallPayload, forgetSubscriptionDeferredInstallRequest,
	registerSubscriptionDeferredInstallPayloadRequest
} from "services/subscription-deferred-install-service";
import { Request } from "express";

describe("subscription-deferred-install-service", () => {
	describe("extractSubscriptionDeferredInstallPayload & registerSubscriptionDeferredInstallPayloadRequest", () => {

		it("round-trips", async () => {
			const payload = {
				installationIdPk: 1,
				orgName: "myOgName",
				gitHubInstallationId: 2
			};
			const requestId = await registerSubscriptionDeferredInstallPayloadRequest(payload);

			expect(await extractSubscriptionDeferredInstallPayload({
				params: {
					requestId
				}
			} as unknown as Request)).toStrictEqual(payload);
		});

		it("throws an exception when requestId is unknown or invalid", async () => {
			await expect(extractSubscriptionDeferredInstallPayload({
				params: {
					requestId: "foo"
				}
			} as unknown as Request)).toReject();
		});
	});

	describe("forgetSubscriptionDeferredInstallRequest", () => {

		it("forgets the request", async () => {
			const payload = {
				installationIdPk: 1,
				orgName: "myOgName",
				gitHubInstallationId: 2
			};
			const requestId = await registerSubscriptionDeferredInstallPayloadRequest(payload);
			const request = {
				params: {
					requestId
				}
			} as unknown as Request;
			await forgetSubscriptionDeferredInstallRequest(request);

			await expect(extractSubscriptionDeferredInstallPayload(request)).toReject();
		});
	});
});

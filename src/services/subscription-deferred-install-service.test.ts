import {
	extractSubscriptionDeferredInstallPayload, forgetSubscriptionDeferredInstallRequest,
	registerSubscriptionDeferredInstallPayloadRequest, SubscriptionDeferredInstallPayload
} from "services/subscription-deferred-install-service";

describe("subscription-deferred-install-service", () => {
	describe("extractSubscriptionDeferredInstallPayload & registerSubscriptionDeferredInstallPayloadRequest", () => {

		it("round-trips", async () => {
			const payload = {
				installationIdPk: 1,
				orgName: "myOgName",
				gitHubInstallationId: 2
			};
			const requestId = await registerSubscriptionDeferredInstallPayloadRequest(payload);

			expect(await extractSubscriptionDeferredInstallPayload(requestId)).toStrictEqual(payload);
		});

		it("throws an exception when requestId is unknown or invalid", async () => {
			await expect(extractSubscriptionDeferredInstallPayload("foo")).toReject();
		});
	});

	describe("extractSubscriptionDeferredInstallPayload", () => {
		it("throws an exception when empty requestId", async () => {
			await expect(extractSubscriptionDeferredInstallPayload(undefined)).toReject();
		});

		it("throws an exception when invalid requestId", async () => {
			await expect(extractSubscriptionDeferredInstallPayload("unknown")).toReject();
		});

		it("throws an exception when payload is corrupted", async () => {
			const corruptedPayload = { };
			const requestId = await registerSubscriptionDeferredInstallPayloadRequest(corruptedPayload as unknown as SubscriptionDeferredInstallPayload);
			await expect(extractSubscriptionDeferredInstallPayload(requestId)).toReject();
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
			await forgetSubscriptionDeferredInstallRequest(requestId);

			await expect(extractSubscriptionDeferredInstallPayload(requestId)).toReject();
		});
	});
});


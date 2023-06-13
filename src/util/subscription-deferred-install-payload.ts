import { EncryptionClient } from "utils/encryption-client";
import { Request } from "express";

export interface SubscriptionDeferredInstallPayload {
	installationIdPk: number,
	gitHubServerAppIdPk: number | undefined,
	gitHubInstallationId: number,
	orgName: string
}

export const extractParsedPayload = async (req: Request) => {
	try {
		const parsedPayload = JSON.parse(await EncryptionClient.decrypt(req.params["payload"], {})) as SubscriptionDeferredInstallPayload;
		if (!parsedPayload.installationIdPk) {
			throw new Error("No installationIdPk");
		}

		if (!parsedPayload.gitHubInstallationId) {
			throw new Error("No gitHubInstallationId");
		}

		if (!parsedPayload.orgName) {
			throw new Error("No orgName");
		}

		return parsedPayload;
	} catch (err) {
		req.log.warn({ err }, "Cannot extract payload");
		throw err;
	}
};

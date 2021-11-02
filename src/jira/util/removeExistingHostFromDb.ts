import { Request } from "express";
import { Installation, Subscription } from "../../models";

export const removeExistingHostFromInstallationsTable = async (jiraHost: string, req: Request): Promise<void> => {
	const installations = await Installation.getAllForHost(jiraHost)

	if (installations) {
		req.log.info({ jiraHost }, "Found existing instances for jiraHost in installations table.");
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		await Promise.all(installations.map((installation) => installation.uninstall())); // TODO - add typing for installation
	}
}

export const removeExistingHostFromSubscriptionsTable = async (jiraHost: string): Promise<void> => {
	const subscriptions = await Subscription.getAllForHost(jiraHost);

	if (subscriptions) {
		await Promise.all(subscriptions.map((sub) => sub.uninstall())); // TODO - add typing for sub
	}
}

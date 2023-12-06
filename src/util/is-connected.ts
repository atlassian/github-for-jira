import { Subscription } from "models/subscription";

export const isConnected = async (jiraHost: string): Promise<boolean> => {
	const subscriptions = await Subscription.getAllForHost(jiraHost);

	return subscriptions.length > 0;
};

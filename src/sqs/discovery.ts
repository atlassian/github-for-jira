import { MessageHandler } from "./index";
import { discovery } from "../sync/discovery";

export type DiscoveryMessagePayload = {
	installationId: number,
	jiraHost: string
}

export const discoveryQueueMessageHandler: MessageHandler<DiscoveryMessagePayload> = async (context) => {
	context.log = context.log.child({
		jiraHost: context?.payload?.jiraHost,
		installationId: context?.payload?.installationId
	});
	await discovery(context.payload, context.log);
};

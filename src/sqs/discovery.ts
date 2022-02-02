import {MessageHandler} from "./index"
import app from "../worker/app";
import {discovery} from "../sync/discovery";

export type DiscoveryMessagePayload = {
	installationId: number,
	jiraHost: string,

	// the repo is only set for messages that discover a single repo
	repo?: {
		id: number,
		owner: string,
		name: string
	}
}

export const discoveryQueueMessageHandler : MessageHandler<DiscoveryMessagePayload> = async (context) => {
	await discovery(app)(context.payload, context.log);
}

import {MessageHandler} from "./index"
import app from "../worker/app";
import {discovery} from "../sync/discovery";

export type DiscoveryMessagePayload = {
	installationId: number,
	jiraHost: string
}

export const discoveryQueueMessageHandler : MessageHandler<DiscoveryMessagePayload> = async (context) => {
	await discovery(app)({data: context.payload}, context.log);
}

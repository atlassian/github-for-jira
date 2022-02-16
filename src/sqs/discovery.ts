import { MessageHandler } from "./index"
import app from "../worker/app";
import { discovery } from "../sync/discovery";
// import { booleanFlag, BooleanFlags } from "../config/feature-flags";

export type DiscoveryMessagePayload = {
	installationId: number,
	jiraHost: string
}

export const discoveryQueueMessageHandler : MessageHandler<DiscoveryMessagePayload> = async (context) => {
	// const useNewGHClient = true;// await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_DISCOVERY, false, jiraHost);
	// if (useNewGHClient)  {
	await discovery(app)({data: context.payload}, context.log);
	// } else {
	// 	await discoveryOld(app)({data: context.payload}, context.log);
	// }
}

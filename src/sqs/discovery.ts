import { MessageHandler } from "./index";
import app from "../worker/app";
import { discovery, discoveryOctoKit } from "../sync/discovery";
// import { booleanFlag, BooleanFlags } from "../config/feature-flags";

export type DiscoveryMessagePayload = {
	installationId: number,
	jiraHost: string
}

export const discoveryQueueMessageHandler : MessageHandler<DiscoveryMessagePayload> = async (context) => {
	const useNewGHClient = true;///await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_DISCOVERY, false, context?.payload?.jiraHost);
	if(useNewGHClient) {
		console.log("NEWCLIENT");
		await discovery({ data: context.payload }, context.log);
		return;
	}
	console.log("OCTOCAT");
	await discoveryOctoKit(app)({ data: context.payload }, context.log);
};

import { booleanFlag, BooleanFlags } from "config/feature-flags";

export const gheServerAuthAndConnectFlowFlag = async (jiraHost: string) => {
	return await booleanFlag(BooleanFlags.GHE_SERVER_AUTH_AND_CONNECT_FLOW, false, jiraHost)
}



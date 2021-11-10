import { MessageHandler } from "./index"
import {booleanFlag, BooleanFlags} from "../config/feature-flags";


export type BackfillMessagePayload = {
	gitHubInstallationId: number,
	jiraHost: string
}

export const backfillQueueMessageHandler : MessageHandler<BackfillMessagePayload> = async (context) => {
	if(!await booleanFlag(BooleanFlags.NEW_BACKFILL_PROCESS_ENABLED, false, context.payload.jiraHost)) {
		context.log.info("New backfill process disabled, dropping the message ");
		return
	}
	context.log.info("Porcessing backfill message");
}

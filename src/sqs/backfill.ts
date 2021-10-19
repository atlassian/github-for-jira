import { MessageHandler } from './index'


export type BackfillMessagePayload = {
	gitHubInstallationId: number,
	jiraHost: string
}

export const backfillQueueMessageHandler : MessageHandler<BackfillMessagePayload> = {

	async handle(context) {
		context.log.info("Porcessing backfill message");
	}
}

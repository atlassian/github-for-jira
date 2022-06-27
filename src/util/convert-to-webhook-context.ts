import { CustomContext } from "middleware/github-webhook-middleware";
import { WebhookContext } from "../routes/github/webhook/webhook-context";

export const convertToWebhookContext = (callback: (webhookContext: WebhookContext) => Promise<void>) =>
	async (context: CustomContext): Promise<void> => {
		const webhookContext = new WebhookContext({
			id: context.id,
			name: context.name,
			payload: context.payload,
			action: context.payload.action,
			log: context.log
		});
		// Todo: optional field, will remove once all references which are behind FF will be removed.
		webhookContext.github = context.github;
		await callback(webhookContext);
	};
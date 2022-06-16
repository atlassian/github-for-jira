import type { WebhookEvent, WebhookEventName } from "@octokit/webhooks-types";

export class WebhookContext<E extends WebhookEvent = WebhookEvent> {
	id: string;
	name: WebhookEventName;
	payload: E;
	webhookReceived: number;
	log: any; //TODO: proper typing to remove probot
	action?: string;
}

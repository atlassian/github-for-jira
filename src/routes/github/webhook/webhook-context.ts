import Logger from "bunyan";
import * as Sentry from "@sentry/node";

export class WebhookContext<E = any> {
	id: string;
	name: string;
	payload: E;
	log: Logger;
	action?: string;
	sentry?: Sentry.Hub;
	timedout?: number;
	webhookReceived?: number;

	constructor({ id, name, payload, log, action }) {
		this.id = id;
		this.name = name;
		this.payload = payload;
		this.log = log;
		this.action = action;
	}
}
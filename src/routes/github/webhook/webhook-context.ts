import * as Sentry from "@sentry/node";
import { GitHubAPI } from "probot";
import { LoggerWithTarget } from "probot/lib/wrap-logger";

export class WebhookContext<E = any> {
	id: string;
	name: string;
	payload: E;
	log: LoggerWithTarget;
	action?: string;
	sentry?: Sentry.Hub;
	timedout?: number;
	webhookReceived?: number;
	// Todo: delete github once all references to github has been removed. Found some reference behind FF
	github: GitHubAPI;

	constructor({ id, name, payload, log, action }) {
		this.id = id;
		this.name = name;
		this.payload = payload;
		this.log = log;
		this.action = action;
	}
}
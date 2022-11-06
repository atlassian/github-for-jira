import * as Sentry from "@sentry/node";
import Logger from "bunyan";

type WebhookContextConstructorParam <E = any> = {
	id: string;
	name: string;
	payload: E;
	log: Logger;
	action?: string;
	gitHubAppConfig: GitHubAppConfig;
}

export class WebhookContext<E = any> {
	id: string;
	name: string;
	payload: E;
	log: Logger;
	action?: string;
	sentry?: Sentry.Hub;
	timedout?: number;
	webhookReceived?: number;

	gitHubAppConfig: GitHubAppConfig;

	constructor({ id, name, payload, log, action, gitHubAppConfig }: WebhookContextConstructorParam<E>) {
		this.id = id;
		this.name = name;
		this.payload = payload;
		this.log = log;
		this.action = action;
		this.gitHubAppConfig = gitHubAppConfig;
	}
}

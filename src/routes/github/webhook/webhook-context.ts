import Logger from "bunyan";

export class WebhookContext <E = any> {
	id: string;
	name: string;
	payload: E;
	log: Logger;
	action?: string;

	constructor({ id, name, payload, log, action }) {
		this.id = id;
		this.name = name;
		this.payload = payload;
		this.log = log;
		this.action = action;
	}
}
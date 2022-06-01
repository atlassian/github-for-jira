import Logger from "bunyan";

export class WebhookContext {
	id: string;
	name: string;
	payload: any;
	log: Logger;

	constructor({ id, name, payload, log }) {
		this.id = id;
		this.name = name;
		this.payload = payload;
		this.log = log
	}

	repo() {
		const repo = this.payload?.repository;
		if (!repo) {
			throw new Error(
				"context.repo() is not supported for this webhook event."
			);
		}
		return Object.assign(
			{
				owner: repo.owner.login,
				repo: repo.name,
			}
		);
	}
}
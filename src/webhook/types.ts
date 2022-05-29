/* eslint-disable @typescript-eslint/ban-types */

import Logger from "bunyan";

type Hooks = {
	[key: string]: Function[];
};

export interface State {
	hooks: Hooks;
}

export class WebhookContext {
	id: string;
	name: string;
	payload: any;
	signature: string;
	log: Logger;

	constructor({ id, name, payload, signature, log }) {
		this.id = id;
		this.name = name;
		this.payload = payload;
		this.signature = signature;
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
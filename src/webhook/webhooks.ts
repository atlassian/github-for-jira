/* eslint-disable @typescript-eslint/ban-types */
import { receiverOn } from "./on";
import { receiverHandle } from "./receive";
import { State, WebhookContext } from "./types";

export class Webhooks {
	public on: (event: string | string[], callback: Function) => void;
	public receive: (eventPayload: WebhookContext) => Promise<void>;

	constructor() {
		const state: State = {
			hooks: {}
		};
		this.on = receiverOn.bind(null, state);
		this.receive = receiverHandle.bind(null, state);
	}
}

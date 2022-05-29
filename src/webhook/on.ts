/* eslint-disable @typescript-eslint/ban-types */
import { State } from "./types";

export function receiverOn(
	state: State,
	webhookNameOrNames: string | string[],
	handler: Function
) {
	if (Array.isArray(webhookNameOrNames)) {
		webhookNameOrNames.forEach((webhookName) =>
			receiverOn(state, webhookName, handler)
		);
		return;
	}
	handleEventHandlers(state, webhookNameOrNames, handler);
}

function handleEventHandlers(
	state: State,
	webhookName: string,
	handler: Function
) {
	if (!state.hooks[webhookName]) {
		state.hooks[webhookName] = [];
	}

	state.hooks[webhookName].push(handler);
}
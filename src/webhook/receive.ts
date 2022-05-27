/* eslint-disable @typescript-eslint/ban-types */
import { State, WebhookContext } from "./types";

function getHooks(state: State, eventName: string, eventPayloadAction: string | null): Function[] {
	const hooks = [state.hooks[eventName], state.hooks["*"]];
	if (eventPayloadAction) {
		hooks.unshift(state.hooks[`${eventName}.${eventPayloadAction}`]);
	}
	return ([] as Function[]).concat(...hooks.filter(Boolean)); // convert array of array to flat array
}

export async function receiverHandle(state: State, event: WebhookContext) {

	const hooks = getHooks(state, event.name, "action" in event.payload ? event.payload.action : null);
	if (hooks.length === 0) {
		return Promise.resolve();
	}

	const promises = hooks.map((handler: Function) => {
		const promise = Promise.resolve(event);
		return promise
			.then((event) => {
				return handler(event);
			})
			.catch((error) => console.log(error));
	});

	return Promise.all(promises).then(() => {
		console.log("Processing completed!!");

	});
}
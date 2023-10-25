/* eslint-disable @typescript-eslint/no-explicit-any */

/*
 * Acts like a Sentry scope. See https://docs.sentry.io/enriching-error-data/scopes/?platform=node#configuring-the-scope
 *
 * Useful in contexts where a Sentry scope isn't available, like within the custom exception class.
 * Use `SentryScopeProxy.processEvent` to propogate the error scope for thrown exceptions.
 *
 * Learn more at https://docs.sentry.io/platforms/node/#eventprocessors
 */
export class SentryScopeProxy {
	event: any;
	hint: any;
	extra: Record<string, any>;
	fingerprint: (string | number)[] | undefined;

	constructor() {
		this.extra = {};
	}

	static processEvent(this: void, event: any, hint: any) {
		if (hint.originalException.sentryScope) {
			hint.originalException.sentryScope.addTo(event);
		}

		return event;
	}

	setExtra(key, value) {
		this.extra[key] = value;
	}

	setFingerprint(fingerprint) {
		this.fingerprint = fingerprint;
	}

	addTo(event) {
		event.extra = Object.assign(event.extra, this.extra);

		if (this.fingerprint) {
			event.fingerprint = this.fingerprint;
		}
	}
}

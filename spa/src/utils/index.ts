import * as Sentry from "@sentry/react";

export const getJiraJWT = (): Promise<string> => new Promise(resolve => {
	return AP.context.getToken((token: string) => {
		resolve(token);
	});
});

export function popup (url: string) {
	return window.open(url, "_blank");
}

export function reportError(err: unknown) {
	try {
		Sentry.captureException(err);
	} catch (_) {
		//do nothing
	}
}

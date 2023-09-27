import * as Sentry from "@sentry/react";

export const getJiraJWT = (): Promise<string> => new Promise(resolve => {
	return AP.context.getToken((token: string) => {
		resolve(token);
	});
});

export function popup (url: string) {
	const openedPopup = window.open(url, "_blank");
	if (!openedPopup || openedPopup.closed || typeof openedPopup.closed === "undefined") {
		// TODO: Meaningful UI when browser pop-up is blocked
		localStorage.setItem("isPopupBlocked", "true");
		return null;
	}
	localStorage.removeItem("isPopupBlocked");
	return openedPopup;
}

export function reportError(err: unknown, extra: {
	path: string,
	reason?: string
} & Record<string, unknown>) {
	try {
		Sentry.captureException(err, {
			extra: {
				...extra
			}
		});
	} catch (_) {
		//do nothing
	}
}

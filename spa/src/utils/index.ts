import * as Sentry from "@sentry/react";
import { AxiosError } from "axios";

export const getJiraJWT = (): Promise<string> => new Promise(resolve => {
	return AP.context.getToken((token: string) => {
		resolve(token);
	});
});

export function popup (url: string) {
	const openedPopup = window.open(url, "_blank");
	if (!openedPopup || openedPopup.closed || typeof openedPopup.closed === "undefined") {
		return null;
	}
	return openedPopup;
}

export function reportError(err: unknown, extra: {
	path: string,
	reason?: string
} & Record<string, unknown>) {
	try {

		const cause = (err as Record<string, unknown>).cause || {};
		delete (err as Record<string, unknown>).cause; //so that Sentry doesn't group all axios error together

		Sentry.captureException(err, {
			extra: {
				...extra,
				...(err instanceof AxiosError ? extractKeyErrorInfo(err) : {}),
				cause: {
					...(cause instanceof AxiosError ? extractKeyErrorInfo(cause) : cause),
				}
			}
		});
	} catch (_) {
		//do nothing
	}
}

function extractKeyErrorInfo(e: AxiosError) {
	return {
		errMessage: e.message,
		errCode: e.code,
		errMethod: e.config?.method,
		errStatusCode: e.response?.status,
		errBody: e.response?.data
	};
}

export function openChildWindow(url: string) {
	const child: Window | null = window.open(url);
	const interval = setInterval(function () {
		if (child?.closed) {
			clearInterval(interval);
			AP.navigator.reload();
		}
	}, 100);
	return child;
}

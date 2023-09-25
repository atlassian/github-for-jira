import { errorWrapper } from "~/src/rest/helper";
import { Request, Response } from "express";
import { ScreenEventProps, sendAnalytics, TrackOpUiEventProps } from "~/src/util/analytics-client";
import { BaseLocals } from "..";

type AnalyticsScreenPayload = {
	eventType: "screen";
	eventProperties: ScreenEventProps & Record<string, unknown>;
	eventAttributes?: Record<string, unknown>;
}

type AnalyticsTrackUiPayload = {
	eventType: "ui" | "track";
	eventProperties: TrackOpUiEventProps & Record<string, unknown>;
	eventAttributes?: Record<string, unknown>;
}

const isRecord = (obj: unknown): obj is Record<string, unknown> =>
	typeof obj === "object" && obj !== null;

const isTrackUiEventProps = (obj: unknown): obj is TrackOpUiEventProps =>
	isRecord(obj) &&
	typeof obj.actionSubject === "string" &&
	typeof obj.action === "string" &&
	typeof obj.source === "string";

const isScreenEventProps = (obj: unknown): obj is ScreenEventProps =>
	isRecord(obj) &&
	typeof obj.name === "string";

const isAnalyticsScreenPayload = (obj: unknown): obj is AnalyticsScreenPayload =>
	isRecord(obj) &&
	obj.eventType === "screen" &&
	isScreenEventProps(obj.eventProperties) &&
	(obj.eventAttributes === undefined || isRecord(obj.eventAttributes));

const isAnalyticsTrackUiPayload = (obj: unknown): obj is AnalyticsTrackUiPayload =>
	isRecord(obj) &&
	(obj.eventType === "ui" || obj.eventType === "track") &&
	isTrackUiEventProps(obj.eventProperties) &&
	(obj.eventAttributes === undefined || isRecord(obj.eventAttributes));

export const AnalyticsProxyHandler = errorWrapper("AnalyticsProxyHandler", async function AnalyticsProxyPost(req: Request, res: Response<string, BaseLocals>) {
	if (isAnalyticsScreenPayload(req.body)) {
		await sendAnalytics(res.locals.jiraHost, "screen", req.body.eventProperties, req.body.eventAttributes || {}, res.locals.accountId);
		res.sendStatus(202);

		// Had to break into two identical IFs because Typescript is not smart enough to parse a single one
	} else if (isAnalyticsTrackUiPayload(req.body)) {
		await sendAnalytics(res.locals.jiraHost, req.body.eventType, req.body.eventProperties, req.body.eventAttributes || {}, res.locals.accountId);

		res.sendStatus(202);
	} else {

		req.log.warn("Invalid payload: " + JSON.stringify(req.body));
		res.sendStatus(400);
	}
});

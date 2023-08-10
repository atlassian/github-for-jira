import { errorWrapper } from "~/src/rest/helper";
import { Request, Response } from "express";
import { sendAnalytics } from "utils/analytics-client";

interface TrackUiEventProps {
	actionSubject: string,
	action: string
}

interface ScreenEventProps {
	name: string
}

interface AnalyticsPayloadScreen {
	eventType: "screen";
	eventProperties: ScreenEventProps & Record<string, unknown>;
	eventAttributes?: Record<string, unknown>;
}

interface AnalyticsPayloadTrackUi {
	eventType: "ui" | "track";
	eventProperties: TrackUiEventProps & Record<string, unknown>;
	eventAttributes?: Record<string, unknown>;
}

// AUTO-GENERATED BELOW, RE-GENERATE IF CHANGED
// Prompt: ChatGPT, generate isAnalyticsPayloadTrackUi and isAnalyticsPayloadScreen for these TypeScript classes using arrow functions, double quotes and "unknown" type
const isRecord = (obj: unknown): obj is Record<string, unknown> =>
	typeof obj === "object" && obj !== null;

const isTrackUiEventProps = (obj: unknown): obj is TrackUiEventProps =>
	isRecord(obj) &&
	typeof obj.actionSubject === "string" &&
	typeof obj.action === "string";

const isScreenEventProps = (obj: unknown): obj is ScreenEventProps =>
	isRecord(obj) &&
	typeof obj.name === "string";

const isAnalyticsPayloadScreen = (obj: unknown): obj is AnalyticsPayloadScreen =>
	isRecord(obj) &&
	obj.eventType === "screen" &&
	isScreenEventProps(obj.eventProperties) &&
	(obj.eventAttributes === undefined || isRecord(obj.eventAttributes));

const isAnalyticsPayloadTrackUi = (obj: unknown): obj is AnalyticsPayloadTrackUi =>
	isRecord(obj) &&
	(obj.eventType === "ui" || obj.eventType === "track") &&
	isTrackUiEventProps(obj.eventProperties) &&
	(obj.eventAttributes === undefined || isRecord(obj.eventAttributes));
// AUTO-GENERATED ABOVE, RE-GENERATE IF CHANGED (thanks, ChatGPT+++)

export const AnalyticsHandler = errorWrapper("ScreenAnalyticsHandler", async function ScreenAnalyticsPost(req: Request, res: Response<string>) {
	if (isAnalyticsPayloadScreen(req.body)) {
		await sendAnalytics(res.locals.jiraHost, "screen", req.body.eventProperties, req.body.eventAttributes || {}, res.locals.accountId);
		res.sendStatus(202);

	} else if (isAnalyticsPayloadTrackUi(req.body)) {
		await sendAnalytics(res.locals.jiraHost, req.body.eventType, {
			source: "spa",
			...req.body.eventProperties
		}, req.body.eventAttributes || {}, res.locals.accountId);

		res.sendStatus(202);
	} else {

		req.log.warn("Invalid payload: " + JSON.stringify(req.body));
		res.sendStatus(400);
	}
});

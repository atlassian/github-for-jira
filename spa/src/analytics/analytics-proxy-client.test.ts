import { analyticsProxyClient } from "./analytics-proxy-client";
import { waitFor } from "@testing-library/react";
import nock from "nock";
import { axiosRest } from "../api/axiosInstance";
import { ScreenEventProps, TrackEventProps, UIEventProps } from "./types";

const MY_TOKEN = "myToken";

/* eslint-disable @typescript-eslint/no-explicit-any*/
(global as any).AP = {
	getLocation: jest.fn(),
	context: {
		getContext: jest.fn(),
		getToken: (callback: (token: string) => void) => {
			callback(MY_TOKEN);
		}
	},
	navigator: {
		go: jest.fn(),
		reload: jest.fn()
	}
};

describe("analytics-proxy-client", () => {
	const BASE_URL = "http://localhost";
	const ANALYTICS_PROXY_URL = "/rest/app/cloud/analytics-proxy";
	const UI_PROPS: UIEventProps = {
		actionSubject: "startToConnect", action: "clicked"
	};
	const TRACK_PROPS: TrackEventProps = {
		actionSubject: "finishOAuthFlow", action: "success"
	};
	const SCREEN_PROPS: ScreenEventProps = {
		name: "StartConnectionEntryScreen"
	};
	const ATTRS = { myAttr: "foobar" };

	beforeEach(() => {
		axiosRest.defaults.baseURL = BASE_URL;

		nock(BASE_URL)
			.options(ANALYTICS_PROXY_URL)
			.reply(200, undefined, {
				"Access-Control-Allow-Methods": "OPTIONS, GET, HEAD, POST",
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Headers": "Authorization",
				"Allow": "OPTIONS, GET, HEAD, POST"
			});
	});

	afterEach(() => {
		axiosRest.defaults.baseURL = undefined;
	});

	it("add source to UI events", async () => {
		const expectedNock = nock(BASE_URL)
			.post(ANALYTICS_PROXY_URL, {
				eventType: "ui",
				eventProperties: {
					...UI_PROPS,
					source: "spa"
				},
				eventAttributes: ATTRS
			})
			.matchHeader("Authorization", MY_TOKEN)
			.reply(202, {});

		analyticsProxyClient.sendUIEvent(UI_PROPS, ATTRS);

		await waitFor(() => {
			expect(expectedNock.isDone()).toBeTruthy();
		});
	});

	it("add source to Track events", async () => {
		const expectedNock = nock(BASE_URL)
			.post(ANALYTICS_PROXY_URL, {
				eventType: "track",
				eventProperties: {
					...TRACK_PROPS,
					source: "spa"
				},
				eventAttributes: ATTRS
			})
			.matchHeader("Authorization", MY_TOKEN)
			.reply(202, {});

		analyticsProxyClient.sendTrackEvent(TRACK_PROPS, ATTRS);

		await waitFor(() => {
			expect(expectedNock.isDone()).toBeTruthy();
		});
	});

	it("sends Screen event as it is", async () => {
		const expectedNock = nock(BASE_URL)
			.post(ANALYTICS_PROXY_URL, {
				eventType: "screen",
				eventProperties: SCREEN_PROPS,
				eventAttributes: ATTRS
			})
			.matchHeader("Authorization", MY_TOKEN)
			.reply(202, {});

		analyticsProxyClient.sendScreenEvent(SCREEN_PROPS, ATTRS);

		await waitFor(() => {
			expect(expectedNock.isDone()).toBeTruthy();
		});
	});

});

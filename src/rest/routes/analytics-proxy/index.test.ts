import { encodeSymmetric } from "atlassian-jwt";
import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";
import supertest from "supertest";
import { sendAnalytics } from "utils/analytics-client";

jest.mock("utils/analytics-client", () => ({
	sendAnalytics: jest.fn()
}));

describe("AnalyticsProxyHandler", () => {
	const testSharedSecret = "test-secret";
	const getToken = ({
		secret = testSharedSecret,
		iss = "jira-client-key",
		exp = Date.now() / 1000 + 10000,
		qsh = "context-qsh",
		sub = "myAccount" } = {}): string => {
		return encodeSymmetric({
			qsh,
			iss,
			exp,
			sub
		}, secret);
	};
	let app;
	beforeEach(async () => {
		app = getFrontendApp();
		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});
		jest.resetAllMocks();
	});

	it.each([
		{
			eventType: "screen",
			eventProperties: {
				name: "blah"
			}
		},
		{
			eventType: "screen",
			eventProperties: {
				name: "blah",
				extraProps: "myProp"
			}
		},
		{
			eventType: "screen",
			eventProperties:  {
				name: "blah"
			},
			eventAttributes: {
				some: "attr"
			}
		},

		{
			eventType: "ui",
			eventProperties: {
				action: "myAction",
				actionSubject: "myActionSubject",
				source: "mySource"
			}
		},
		{
			eventType: "ui",
			eventProperties: {
				action: "myAction",
				actionSubject: "myActionSubject",
				source: "mySource",
				extraProps: "myProp"
			}
		},
		{
			eventType: "ui",
			eventProperties:  {
				action: "myAction",
				actionSubject: "myActionSubject",
				source: "mySource"
			},
			eventAttributes: {
				some: "attr"
			}
		},

		{
			eventType: "track",
			eventProperties: {
				action: "myAction",
				actionSubject: "myActionSubject",
				source: "mySource"
			}
		},
		{
			eventType: "track",
			eventProperties: {
				action: "myAction",
				actionSubject: "myActionSubject",
				source: "mySource",
				extraProps: "myProp"
			}
		},
		{
			eventType: "track",
			eventProperties:  {
				action: "myAction",
				actionSubject: "myActionSubject",
				source: "mySource"
			},
			eventAttributes: {
				some: "attr"
			}
		}
	])("should proxy correct events to analytics client %s", async (correctEvent) => {
		const resp = await supertest(app)
			.post("/rest/app/cloud/analytics-proxy")
			.set("authorization", `${getToken()}`)
			.send(correctEvent);
		expect(resp.status).toStrictEqual(202);
		expect(sendAnalytics as jest.Mock).toHaveBeenCalledWith(jiraHost, correctEvent.eventType, correctEvent.eventProperties, correctEvent.eventAttributes || {}, "myAccount");
	});

	it.each([
		{
			eventProperties: {
				name: "blah"
			}
		},
		{
			eventType: "screen"
		},
		{
			eventType: "screen",
			eventProperties:  {
			},
			eventAttributes: {
				some: "attr"
			}
		},

		{
			eventType: "ui",
			eventProperties: {
				actionSubject: "myActionSubject",
				source: "mySource"
			}
		},
		{
			eventType: "ui",
			eventProperties: {
				action: "myAction",
				source: "mySource",
				extraProps: "myProp"
			}
		},
		{
			eventType: "ui",
			eventProperties:  {
				action: "myAction",
				actionSubject: "myActionSubject"
			},
			eventAttributes: {
				some: "attr"
			}
		},

		{
			eventType: "track",
			eventProperties: {
				actionSubject: "myActionSubject",
				source: "mySource"
			}
		},
		{
			eventType: "track",
			eventProperties: {
				action: "myAction",
				source: "mySource",
				extraProps: "myProp"
			}
		},
		{
			eventType: "track",
			eventProperties:  {
				action: "myAction",
				actionSubject: "myActionSubject"
			},
			eventAttributes: {
				some: "attr"
			}
		}
	])("should reject invalid events", async (correctEvent) => {
		const resp = await supertest(app)
			.post("/rest/app/cloud/analytics-proxy")
			.set("authorization", `${getToken()}`)
			.send(correctEvent);
		expect(resp.status).toStrictEqual(400);
		expect(sendAnalytics as jest.Mock).not.toHaveBeenCalled();
	});
});

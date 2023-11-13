import { ScreenEventProps, sendAnalytics } from "utils/analytics-client";
import { SQS } from "aws-sdk";

jest.mock("aws-sdk");

describe("analytics-client", () => {
	let oldMicrosEnvType: string | undefined;

	beforeEach(() => {
		oldMicrosEnvType = process.env.MICROS_ENVTYPE;
		process.env.MICROS_ENVTYPE = "prod";

		(SQS as unknown as jest.Mock).mockImplementation(() => {
			return {
				sendMessage: jest.fn().mockReturnValue({
					promise: jest.fn().mockResolvedValue(true)
				})
			};
		});
	});

	afterEach(() => {
		process.env.MICROS_ENVTYPE = oldMicrosEnvType;
	});

	it("hashes jiraHost attribute before sending", async () => {
		await sendAnalytics(jiraHost, "screen", {} as unknown as ScreenEventProps & Record<string, unknown>, { jiraHost });

		const sendMessageCalls = (SQS as unknown as jest.Mock).mock.results[0].value.sendMessage.mock.calls;

		expect(JSON.parse(sendMessageCalls[0][0].MessageBody).eventPayload.eventAttributes.jiraHost).toStrictEqual("553291b03783c4875ed1b0ae4d1c8dde93070e028bc064137980c99e3e7df1da");
	});

	it("sends analytic event to SQS", async () => {
		await sendAnalytics(jiraHost, "screen", { foo: "bar" } as unknown as ScreenEventProps & Record<string, unknown>, { jiraHost, blah: "baz" }, "myAccountId");

		const sendMessageCalls = (SQS as unknown as jest.Mock).mock.results[0].value.sendMessage.mock.calls;

		const capturedPayload = JSON.parse(sendMessageCalls[0][0].MessageBody);
		expect(capturedPayload).toStrictEqual(
			{
				eventPayload:  {
					accountId: "myAccountId",
					eventAttributes:  {
						appKey: "com.github.integration.test-atlassian-instance",
						blah: "baz",
						jiraHost: "553291b03783c4875ed1b0ae4d1c8dde93070e028bc064137980c99e3e7df1da"
					},
					eventProps:  {
						foo: "bar"
					},
					eventType: "screen"
				},
				jiraHost: "https://test-atlassian-instance.atlassian.net"
			}
		);
	});

	it("does not send analytics for test instances", async () => {
		await sendAnalytics("https://site-1.some-test.atlassian.net", "screen", {} as unknown as ScreenEventProps & Record<string, unknown>, {});
		expect(SQS).not.toHaveBeenCalled();
	});
});

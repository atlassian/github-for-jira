/* eslint-disable @typescript-eslint/no-explicit-any */
import { convertToWebhookContext } from "./convert-to-webhook-context";

describe("convert-to-webhook-context", () => {
	let context;
	beforeEach(async () => {
		context = {
			id: "123",
			name: "issue_comment",
			payload: {
				action: "created",
				sender: { type: "not bot" },
				installation: { id: 1234 }
			}
		};

	});

	it("should call callback with webhookContext", async () => {
		const spy = jest.fn();
		await convertToWebhookContext(spy)(context);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "123",
			name: "issue_comment",
			action: "created"
		}));
	});

});


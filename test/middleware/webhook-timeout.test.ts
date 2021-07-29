/* eslint-disable @typescript-eslint/no-explicit-any */
import webhookTimeout from "../../src/middleware/webhook-timeout";

describe("Webhook Timeout", () => {

	it("sets timedout context with milliseconds", async () => {
		const context: any = {};
		const timeout = webhookTimeout(() => sleep(300), 100);
		await timeout(context);
		expect(context.timedout).toBeGreaterThanOrEqual(100);
		expect(context.timedout).toBeLessThan(300);
	});

	it("clears timeout if successful", async () => {
		const context: any = {};
		await webhookTimeout(jest.fn(), 1)(context);
		await sleep(3);
		expect(context.timedout).toBeUndefined();
	});

	it("clears timeout if error is thrown", async () => {
		const context: any = {};
		await expect(
			webhookTimeout(() => {
				throw new Error("testing error");
			}, 1)(context)
		).rejects.toThrow("testing error");
		await sleep(3);
		expect(context.timedout).toBeUndefined();
	});
});

const sleep = (ms): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

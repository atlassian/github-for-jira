/* eslint-disable @typescript-eslint/no-explicit-any */
import webhookTimeout from "../../src/backend/middleware/webhook-timeout";

describe("Webhook Timeout", () => {

	it("sets timedout context with milliseconds", async () => {
		const timeoutMs = 100;
		const context: any = {};
		const timeout = webhookTimeout(() => sleep(300), timeoutMs);
		await timeout(context);
		// Adding 10% failure range for setTimeout because it's not that accurate
		expect(context.timedout).toBeGreaterThanOrEqual(timeoutMs * 0.9);
		expect(context.timedout).toBeLessThan(300 * 1.1);
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

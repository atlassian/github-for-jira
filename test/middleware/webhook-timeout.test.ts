/* eslint-disable @typescript-eslint/no-explicit-any */

describe("Webhook Timeout", () => {
  let webhookTimeout;
  beforeEach(async () => {
    webhookTimeout = (await import("../../src/middleware/webhook-timeout")).default;
  });

  it("sets timedout context with milliseconds", async () => {
    const context: any = {};
    await webhookTimeout(async () => {
      await sleep(3);
    }, 1)(context);
    expect(context.timedout).toBeGreaterThan(0);
    expect(context.timedout).toBeLessThan(100);
  });

  it("clears timeout if successful", async () => {
    const context: any = {};
    await webhookTimeout(() => undefined, 1)(context);
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

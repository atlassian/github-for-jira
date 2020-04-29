const webhookTimeout = require('../../lib/middleware/webhook-timeout');

describe('Webhook Timeout', () => {
  it('sets timedout context with milliseconds', async () => {
    const context = {};
    await webhookTimeout(async () => { await sleep(3); }, 1)(context);
    expect(context.timedout).toBeGreaterThan(0);
    expect(context.timedout).toBeLessThan(100);
  });

  it('clears timeout if successful', async () => {
    const context = {};
    await webhookTimeout(async () => { }, 1)(context);
    await sleep(3);
    expect(context.timedout).toBeUndefined();
  });

  it('clears timeout if error is thrown', async () => {
    const context = {};
    expect(
      webhookTimeout(async () => { throw new Error('testing error'); }, 1)(context),
    ).rejects.toThrow('testing error');
    await sleep(3);
    expect(context.timedout).toBeUndefined();
  });
});

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

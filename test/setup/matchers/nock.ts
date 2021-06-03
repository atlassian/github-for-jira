import nock from "nock";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeDone(): R;
    }
  }
}

expect.extend({
  toBeDone: <E extends nock.Scope>(scope: E) => {
    const pass = scope.isDone();
    if (pass) {
      return { pass: true, message: () => "Expected nock scope to have pending mocks, but none were found.\n" };
    }
    return {
      pass: false,
      message: () => `Expected nock scope to have no pending mocks, but some were found:\n${JSON.stringify(scope.pendingMocks(), null, 2)}\n`
    };
  }
});

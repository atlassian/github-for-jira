// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace jest {
  // eslint-disable-next-line @typescript-eslint/no-namespace
    interface Matchers<R> {
      toResolve(): Promise<R>;

      toReject(): Promise<R>;
    }
}

expect.extend({
  toResolve: async (promise: Promise<unknown>) => {
    const pass = promise.then(() => true, () => false);
    if (pass) {
      return { pass: true, message: () => "Expected promise to reject, however it resolved.\n" };
    }
    return { pass: false, message: () => "Expected promise to resolve, however it rejected.\n" };
  },
  toReject: async (promise: Promise<unknown>) => {
    const pass = promise.then(() => false, () => true);
    if (pass) {
      return { pass: true, message: () => "Expected promise to resolve, however it rejected.\n" };
    }
    return { pass: false, message: () => "Expected promise to reject, however it resolved.\n" };
  }
});

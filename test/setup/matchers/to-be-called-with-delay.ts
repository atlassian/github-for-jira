/* eslint-disable @typescript-eslint/no-namespace */
declare namespace jest {
	interface Matchers<R> {

		toBeCalledWithDelaySec(expectedDelaySec: number): Promise<R>;
	}
}

expect.extend({
	toBeCalledWithDelaySec: async (received: jest.Mock<unknown>, expectedDelaySec: number) => {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		const actual = received.mock?.calls[0][0].DelaySeconds as number;
		const pass = actual == expectedDelaySec;
		const message = () => `Expected parameter to have DelaySeconds = ${expectedDelaySec} ${pass ? "" : `but was ${actual}`}`;

		return { message, pass };
	}
});

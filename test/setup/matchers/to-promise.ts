/* eslint-disable @typescript-eslint/no-namespace */
declare namespace jest {
	interface Matchers<R> {
		toResolve(): Promise<R>;

		toReject(): Promise<R>;

		toHaveResolved(): Promise<R>;

		toHaveResolvedTimes(times: number): Promise<R>;
	}
}

expect.extend({
	toResolve: async (promise: Promise<unknown>) => {
		let error: Error;
		const pass = await promise.then(() => {
			return true;
		}, (err) => {
			error = err;
			return false;
		});
		if (pass) {
			return { pass: true, message: () => "Expected promise to reject, however it resolved.\n" };
		}
		return {
			pass: false,
			message: () => `Expected promise to resolve, however it rejected with error: \n${error.stack ?? "Missing Stack"}\n`
		};
	},
	toReject: async (promise: Promise<unknown>) => {
		const pass = await promise.then(() => false, () => true);
		if (pass) {
			return { pass: true, message: () => "Expected promise to resolve, however it rejected.\n" };
		}
		return { pass: false, message: () => "Expected promise to reject, however it resolved.\n" };
	},
	toHaveResolved: async (received: jest.Mock<unknown>) => {
		try {
			await Promise.all(received.mock.results
				.filter(result => result.type === "return")
				.map(result => result.value)
			);
			return { pass: true, message: () => `\n\nExpected mock calls to not resolve.\n\n` };
		} catch (e: unknown) {
			return {
				pass: false,
				message: () => `\n\nExpected mock calls to resolve.\n\n`
			};
		}
	},
	toHaveResolvedTimes: async (received: jest.Mock<unknown>, expected: number) => {
		const results = await Promise.allSettled(received.mock.results
			.filter(result => result.type === "return")
			.map(result => result.value)
		);
		const count = results.reduce((num, result) => result.status == "fulfilled" ? num + 1 : num, 0);

		if (count == expected) {
			return { pass: true, message: () => `\n\nExpected number of resolved calls: not ${expected}\n\n` };
		}
		return {
			pass: false,
			message: () => `\n\nExpected number of resolved calls: ${expected}\n\n Received number of resolved calls: ${count}\n\n`
		};
	}
});

export default function waitUntil<T>(
	promiseFactory: () => Promise<T>,
	delayMillis = 100,
	maxAttempts = 30
): Promise<T> {
	let nAttempts = 0;

	let giveItATryPromiseFactory = () => promiseFactory(); // will be reinitialized later

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const reschedule = (error: any) => {
		nAttempts++;
		if (nAttempts >= maxAttempts) {
			return Promise.reject(error);
		}
		return new Promise((resolve) => setTimeout(resolve, delayMillis)).then(() =>
			giveItATryPromiseFactory()
		);
	};

	giveItATryPromiseFactory = () =>
		promiseFactory()
			.then((data) => {
				return Promise.resolve(data);
			})
			.catch(reschedule);

	return giveItATryPromiseFactory();
}

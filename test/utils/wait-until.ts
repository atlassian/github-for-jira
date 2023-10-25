export const waitUntil = <T>(
	predicate: () => Promise<T>,
	delayMillis = 100,
	maxAttempts = 50
): Promise<T> => {
	let attempts = 0;

	const tryPredicate = async () => {
		try {
			return await predicate();
		} catch (error: unknown) {
			attempts++;
			if (attempts >= maxAttempts) {
				return Promise.reject(error);
			}
			await new Promise((resolve) => setTimeout(resolve, delayMillis));
			return await tryPredicate();
		}
	};

	return tryPredicate();
};

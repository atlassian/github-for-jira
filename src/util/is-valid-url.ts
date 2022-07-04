export const isValidUrl = (url: string): boolean => {
	try {
		const { protocol } = new URL(url);
		return (/^https?:$/.test(protocol));
	} catch (err) {
		return false;
	}
};

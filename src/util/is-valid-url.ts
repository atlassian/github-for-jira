const ALLOWED_PROTOCOLS = ["http:", "https:"];

export const isValidUrl = (url: string): boolean => {
	try {
		const { protocol, hostname } = new URL(url);
		return !(!ALLOWED_PROTOCOLS.includes(protocol) || hostname.split(".").length < 2);
	} catch (err) {
		return false;
	}
};

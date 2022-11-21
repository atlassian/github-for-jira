export const extractClientKey = (text: string): string | undefined  => {
	const [, plainClientKey] = /<key>([0-9a-z-:]+)<\/key>/gmi.exec(text) || [undefined, undefined];
	return plainClientKey;
};

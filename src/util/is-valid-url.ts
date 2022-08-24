export const isValidUrl = (url: string): Array<string> | null => {
	const pattern = /^((?:http:\/\/)|(?:https:\/\/))(www.)?((?:[a-zA-Z0-9]+\.[a-z]{3})|(?:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}))([/a-zA-Z0-9.]*)$/gm;
	return url.match(pattern);
};

import { toJson } from "xml2json";
export const extractClientKey = (text: string): string | undefined  => {
	try {
		const json = toJson(text, { object: true });
		return json?.consumer?.key;
	} catch (e) {
		return undefined;
	}
};

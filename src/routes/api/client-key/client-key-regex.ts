import { xml2json } from "xml2json-light";
export const extractClientKey = (text: string): string | undefined  => {
	try {
		const json = xml2json(text, { object: true });
		return json?.consumer?.key;
	} catch (e: unknown) {
		return undefined;
	}
};

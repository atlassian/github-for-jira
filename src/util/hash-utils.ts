import { createHash } from "crypto";

export const hash = (data: string | null | undefined) => {

	if (!data) { return ""; }

	return createHash("sha256").update(data).digest("hex");

};

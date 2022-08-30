import { createHmac } from "crypto";

export const createHashWithSharedSecret = (data?: string): string => {
	if (!data) {
		return "";
	}
	const cleanedData = removeNonAlphaNumericCharacters(data);
	return createHmac("sha256", process.env.GLOBAL_HASH_SECRET)
		.update(cleanedData)
		.digest("hex");
};

const removeNonAlphaNumericCharacters = (str: string): string => {
	return str.replace(/[^\p{L}\p{N}]+/ug, ""); // Tests all unicode characters and only keeps Letters and Numbers
};

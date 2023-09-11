import jsSHA from "jssha";
import envVars from "./../../envVars";

const removeNonAlphaNumericCharacters = (str: string): string => {
	return str.replace(/[^\p{L}\p{N}]+/ug, ""); // Tests all unicode characters and only keeps Letters and Numbers
};
const createHashWithSharedSecret = (data: string) => {
	const cleanedData = removeNonAlphaNumericCharacters(data);

	return new jsSHA("SHA-256", "TEXT", {
		hmacKey: {
			value: envVars.GLOBAL_HASH_SECRET ,
			format: "TEXT"
		}
	}).update(cleanedData)
		.getHash("HEX");
};

export default createHashWithSharedSecret;

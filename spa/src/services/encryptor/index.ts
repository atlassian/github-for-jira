import jsSHA from "jssha";

// TODO: Find out how to get the values for the env variables
const GLOBAL_HASH_SECRET: string = process.env.REACT_APP_GLOBAL_HASH_SECRET || "";
const removeNonAlphaNumericCharacters = (str: string): string => {
	return str.replace(/[^\p{L}\p{N}]+/ug, ""); // Tests all unicode characters and only keeps Letters and Numbers
};
const createHashWithSharedSecret = (data: string) => {
	const cleanedData = removeNonAlphaNumericCharacters(data);

	return new jsSHA("SHA-256", "TEXT", {
		hmacKey: {
			value: GLOBAL_HASH_SECRET ,
			format: "TEXT"
		}
	}).update(cleanedData)
		.getHash("HEX");
};

export default createHashWithSharedSecret;

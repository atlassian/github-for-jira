/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHashWithSharedSecret, createHashWithoutSharedSecret } from "./encryption";

describe("Encryption", () => {
	describe("createHashWithSharedSecret", () => {

		it("should return expected hash value", () => {
			process.env.GLOBAL_HASH_SECRET = "CATS";
			expect(createHashWithSharedSecret("testdata")).toEqual("a1b38e635a284d68b002f3de4b38a89ea6a40a21fbe2dd70f2512c8a6694cdd6");
		});

		it("should return different hash value with a different secret", () => {
			process.env.GLOBAL_HASH_SECRET = "NOTCATS";
			expect(createHashWithSharedSecret("testdata")).not.toEqual("a1b38e635a284d68b002f3de4b38a89ea6a40a21fbe2dd70f2512c8a6694cdd6");
		});

		it("should handle undefined value returning empty string", () => {
			process.env.GLOBAL_HASH_SECRET = "SECRETforNOTHING";
			expect(createHashWithSharedSecret(undefined)).toEqual("");
		});
	});

	describe("createHashWithoutSharedSecret", () => {
		it("should return some hash value", () => {
			expect(createHashWithoutSharedSecret("hello world")).toEqual("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
		});
		it("should return empty value if data is empty", () => {
			expect(createHashWithoutSharedSecret(null)).toBe("");
			expect(createHashWithoutSharedSecret(undefined)).toBe("");
			expect(createHashWithoutSharedSecret("")).toBe("");
		});
		it("should not return same value for two different input", () => {
			expect(createHashWithoutSharedSecret("aaa")).not.toEqual(createHashWithoutSharedSecret("bbb"));
		});
	});

});


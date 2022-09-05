/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHashWithSharedSecret } from "./encryption";

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
});

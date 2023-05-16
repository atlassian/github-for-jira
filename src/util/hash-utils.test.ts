import { hash } from "./hash-utils";

describe("hash", () => {
	it("should return some hash value", () => {
		expect(hash("hello world")).toEqual("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
	});
	it("should return empty value if data is empty", () => {
		expect(hash(null)).toBe("");
		expect(hash(undefined)).toBe("");
		expect(hash("")).toBe("");
	});
	it("should not return same value for two different input", () => {
		expect(hash("aaa")).not.toEqual(hash("bbb"));
	});
});

/* eslint-disable @typescript-eslint/no-explicit-any */

import { replaceSpaceWithHyphenHelper, toLowercaseHelper, concatStringHelper, compareOr, compareAnd } from "./handlebar-helpers";

describe("Handlebar Helpers", () => {
	describe("toLowercaseHelper", () => {
		it("should return empty string with no parameter", () => {
			expect(toLowercaseHelper()).toEqual("");
		});

		it("should return empty string with non stringifyable or falsy parameter", () => {
			expect(toLowercaseHelper(undefined)).toEqual("");
			expect(toLowercaseHelper(null as any)).toEqual("");
			expect(toLowercaseHelper({} as any)).toEqual("");
		});

		it("should return the lowercase string of any stringifyable object", () => {
			expect(toLowercaseHelper("FOO")).toEqual("foo");
			expect(toLowercaseHelper("BaR")).toEqual("bar");
			expect(toLowercaseHelper(10943 as any)).toEqual("10943");
			expect(toLowercaseHelper(new Date(0) as any)).toMatch("thu jan 01 1970");
		});
	});

	describe("replaceSpaceWithHyphenHelper", () => {
		it("should return empty string with no parameter", () => {
			expect(replaceSpaceWithHyphenHelper()).toEqual("");
		});

		it("should return empty string with non stringifyable or falsy parameter", () => {
			expect(replaceSpaceWithHyphenHelper(undefined)).toEqual("");
			expect(replaceSpaceWithHyphenHelper(null as any)).toEqual("");
			expect(replaceSpaceWithHyphenHelper({} as any)).toEqual("");
		});

		it("should return the kebab case string for any stringifyable object", () => {
			expect(replaceSpaceWithHyphenHelper("FOO bar")).toEqual("FOO-bar");
			expect(replaceSpaceWithHyphenHelper("baR")).toEqual("baR");
			expect(replaceSpaceWithHyphenHelper(10943 as any)).toEqual("10943");
			expect(replaceSpaceWithHyphenHelper(new Date(0) as any)).toMatch("Thu-Jan-01-1970");
		});
	});

	describe("concatStringHelper", () => {
		it("should return empty string with no parameter", () => {
			expect(concatStringHelper()).toEqual("");
		});

		it("should return concatenated string of all the parameters separated by space", () => {
			expect(concatStringHelper("I", "am", "Legend")).toEqual("I am Legend");
			expect(concatStringHelper("Gotta", "catch", "'em", "all!")).toEqual("Gotta catch 'em all!");
			expect(concatStringHelper("More", " ", "space")).toEqual("More   space");
		});
	});

	describe("compareOr", () => {
		it("should return false only if all parameters are falsy", () => {
			expect(compareOr(0, 1)).toEqual(true);
			expect(compareOr(1, 1, 1)).toEqual(true);
			expect(compareOr(1, 0, 0)).toEqual(true);
			expect(compareOr(0, 0)).toEqual(false);
			expect(compareOr(0)).toEqual(false);
		});
	});

	describe("compareAnd", () => {
		it("should return true only if all parameters are truthy", () => {
			expect(compareAnd(1, 1, 1)).toEqual(true);
			expect(compareAnd(0, 1)).toEqual(false);
			expect(compareAnd(1, 0, 0)).toEqual(false);
			expect(compareAnd(0, 0)).toEqual(false);
			expect(compareAnd(0)).toEqual(false);
		});
	});
});

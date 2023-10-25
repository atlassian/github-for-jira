import { repoCountToBucket, backfillFromDateToBucket } from "./metric-helpers";

describe("metrics helper", () => {
	describe.each([
		{ repoNum: undefined, bucket: "unknown" },
		{ repoNum: 0, bucket: "0-100" },
		{ repoNum: 10, bucket: "0-100" },
		{ repoNum: 20, bucket: "0-100" },
		{ repoNum: 100, bucket: "100-1000" },
		{ repoNum: 200, bucket: "100-1000" },
		{ repoNum: 1000, bucket: "1000+" },
		{ repoNum: 10000, bucket: "1000+" }
	])("for each repo num", ({ repoNum, bucket }) => {
		it(`should show correct bucket ${bucket} for repo num ${repoNum || "undefined"}`, () => {
			expect(repoCountToBucket(repoNum)).toEqual(bucket);
		});
	});
	describe.each([
		{ daysAgo: undefined, bucket: "all-time" },
		{ daysAgo: -10, bucket: "unknown" },
		{ daysAgo: 10, bucket: "0-30" },
		{ daysAgo: 40, bucket: "30-180" },
		{ daysAgo: 190, bucket: "180-365" },
		{ daysAgo: 400, bucket: "365+" }
	])("for each from date bucket", ({ daysAgo, bucket }) => {
		const getDate = (daysAgo: number | undefined) => {
			if (daysAgo === undefined) return undefined;
			return new Date(new Date().getTime() - (daysAgo * 24 * 60 * 60 * 1000));
		};
		it(`should show correct bucket ${bucket} for ${daysAgo} days ago`, () => {
			expect(backfillFromDateToBucket(getDate(daysAgo))).toEqual(bucket);
		});
	});
});

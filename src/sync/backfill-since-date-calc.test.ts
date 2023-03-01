import { calcNewBackfillSinceDate } from "./backfill-since-date-calc";
import { SyncType } from "~/src/sync/sync.types";

describe("Calculating backfill since date", () => {
	let existingBackfillSince: Date | undefined;
	let newBackfillSinceDate: Date | undefined;
	let syncType: SyncType | undefined;
	const getResult = () => {
		return calcNewBackfillSinceDate(existingBackfillSince, newBackfillSinceDate, syncType);
	};
	describe("For partial sync, should keep the existing regardless", () => {
		beforeEach(() => {
			syncType = "partial";
			existingBackfillSince = new Date();
		});
		it("should resolve to existingBackfillSince with undefined new backfillSince date", () => {
			newBackfillSinceDate = undefined;
			expect(getResult()).toEqual(existingBackfillSince);
		});
		it("should resolve to existingBackfillSince with earlier new backfillSince date", () => {
			newBackfillSinceDate = new Date(existingBackfillSince!.getTime() - 1000);
			expect(getResult()).toEqual(existingBackfillSince);
		});
		it("should resolve to existingBackfillSince with more recent new backfillSince date", () => {
			newBackfillSinceDate = new Date(existingBackfillSince!.getTime() + 1000);
			expect(getResult()).toEqual(existingBackfillSince);
		});
	});
	describe("For full sync", () => {
		beforeEach(()=> {
			syncType = "full";
		});
		describe("with empty existingBackfillSince date", () => {
			beforeEach(()=> {
				existingBackfillSince = undefined;
			});
			it("Should resolve to empty backfillSince date if new date is empty", () => {
				newBackfillSinceDate = undefined;
				expect(getResult()).toBeUndefined();
			});
			it("Should resolve to empty backfillSince date if new date is Not empty", () => {
				newBackfillSinceDate = new Date();
				expect(getResult()).toBeUndefined();
			});
		});
		describe("With existing backfillSince date", () => {
			beforeEach(()=> {
				existingBackfillSince = new Date();
			});
			it("should resolve to existingBackfillSince with undefined new backfillSince date", () => {
				newBackfillSinceDate = undefined;
				expect(getResult()).toEqual(existingBackfillSince);
			});
			it("should resolve to earlier new backfillSince date", () => {
				newBackfillSinceDate = new Date(existingBackfillSince!.getTime() - 1000);
				expect(getResult()).toEqual(newBackfillSinceDate);
			});
			it("should resolve to existing backfillSince with more recent new backfillSince date", () => {
				newBackfillSinceDate = new Date(existingBackfillSince!.getTime() + 1000);
				expect(getResult()).toEqual(existingBackfillSince);
			});
		});
	});
});

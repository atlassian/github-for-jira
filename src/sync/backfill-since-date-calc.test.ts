import { calcNewBackfillSinceDate } from "./backfill-since-date-calc";
import { SyncType } from "~/src/sync/sync.types";

describe("Calculating backfill since date", () => {
	let existingBackfillSince: Date | undefined;
	let newBackfillSinceDate: Date | undefined;
	let syncType: SyncType | undefined;
	let isFirstSyncOnSubscription: boolean;
	const getResult = () => {
		return calcNewBackfillSinceDate(existingBackfillSince, newBackfillSinceDate, syncType, isFirstSyncOnSubscription);
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
		describe("For new fresh sync on new subscription", () => {
			beforeEach(()=> {
				isFirstSyncOnSubscription = true;
				existingBackfillSince = undefined;
			});
			it("Should resolve to new backfillSince date if provided", () => {
				newBackfillSinceDate = new Date();
				expect(getResult()).toEqual(newBackfillSinceDate);
			});
			it("Should resolve to empty backfillSince date if new date is empty", () => {
				newBackfillSinceDate = undefined;
				expect(getResult()).toBeUndefined();
			});
		});
		describe("For sync on existing subscription", () => {
			beforeEach(()=> {
				isFirstSyncOnSubscription = false;
			});
			describe("with an empty backfillSince date", () => {
				beforeEach(() => {
					existingBackfillSince = undefined;
				});
				it("Should resolve to existing empty backfillSince date", () => {
					newBackfillSinceDate = new Date();
					expect(getResult()).toBeUndefined();
				});
			});
			describe("with non-empty backfillSince date", () => {
				beforeEach(() => {
					existingBackfillSince = new Date();
				});
				it("should resolve to existing backfillSince with undefined new backfillSince date", () => {
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
});

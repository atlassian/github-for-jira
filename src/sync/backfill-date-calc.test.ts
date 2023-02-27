import { getLogger } from "config/logger";
import { calcNewBackfillSinceDate } from "./backfill-date-calc";
import { SyncType } from "~/src/sync/sync.types";

describe("Calculating backfill since date", () => {
	let existingBackfillSince: Date | undefined;
	let newBackfillSinceDate: string | undefined;
	let syncType: SyncType | undefined;
	const getResult = () => {
		return calcNewBackfillSinceDate(existingBackfillSince, newBackfillSinceDate, syncType, getLogger("test"));
	};
	describe("For partial sync", () => {
		beforeEach(() => {
			syncType = "partial";
			existingBackfillSince = new Date();
		});
		it("should resolve to existingBackfillSince with undefined new backfillSince date", () => {
			newBackfillSinceDate = undefined;
			expect(getResult()).toEqual(existingBackfillSince);
		});
		it("should resolve to existingBackfillSince with earlier new backfillSince date", () => {
			newBackfillSinceDate = new Date(existingBackfillSince!.getTime() - 1000).toISOString();
			expect(getResult()).toEqual(existingBackfillSince);
		});
		it("should resolve to existingBackfillSince with more recent new backfillSince date", () => {
			newBackfillSinceDate = new Date(existingBackfillSince!.getTime() + 1000).toISOString();
			expect(getResult()).toEqual(existingBackfillSince);
		});
	});
	describe("For full sync", () => {
		beforeEach(()=> {
			syncType = "full";
		});
		describe("For existing syncs with empty backfill date", () => {
			beforeEach(() => {
				existingBackfillSince = undefined;
			});
			describe("Backfill with undefined date", () => {
				beforeEach(() => {
					newBackfillSinceDate = new Date().toISOString();
				});
				it("Should resolve to existing empty backfillSince date", () => {
					expect(getResult()).toBeUndefined();
				});
			});
			describe("Backfill new a recent date", () => {
				beforeEach(() => {
					newBackfillSinceDate = new Date().toISOString();
				});
				it("Should resolve to existing empty backfillSince date", () => {
					expect(getResult()).toBeUndefined();
				});
			});
		});
		describe("For new syncs with existing backfill date", () => {
			beforeEach(() => {
				existingBackfillSince = new Date();
			});
			describe("Backfill with undefined date", () => {
				beforeEach(() => {
					newBackfillSinceDate = undefined;
				});
				it("Should resolve to new undefined backfill date", () => {
					expect(getResult()).toEqual(undefined);
				});
			});
			describe("Backfill with a more recent date", () => {
				beforeEach(() => {
					newBackfillSinceDate = new Date(existingBackfillSince!.getTime() + 1000).toISOString();
				});
				it("Should resolve to existingBackfillSince date", () => {
					expect(getResult()).toEqual(existingBackfillSince);
				});
			});
			describe("Backfill with a more older date", () => {
				beforeEach(() => {
					newBackfillSinceDate = new Date(existingBackfillSince!.getTime() - 1000).toISOString();
				});
				it("Should resolve to the more older (new backfill since) date", () => {
					expect(getResult()).toEqual(new Date(newBackfillSinceDate!));
				});
			});
		});
	});
});

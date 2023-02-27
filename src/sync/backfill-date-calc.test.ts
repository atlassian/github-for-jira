import { getLogger } from "config/logger";
import { calcNewBackfillSinceDate } from "./backfill-date-calc";

describe("Calculating backfill since date", () => {
	let existingBackfillSince: Date | undefined;
	let newBackfillSinceDate: string | undefined;
	const getResult = () => {
		return calcNewBackfillSinceDate(existingBackfillSince, newBackfillSinceDate, getLogger("test"));
	};
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
				newBackfillSinceDate = new Date().toISOString();
			});
			it("Should resolve to existingBackfillSince date", () => {
				expect(getResult()).toEqual(existingBackfillSince);
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


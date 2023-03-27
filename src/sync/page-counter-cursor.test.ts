import { PageSizeAwareCounterCursor } from "./page-counter-cursor";

describe("PageSizeAwareCounterCursor", () => {
	describe("serialized data provided", () => {
		describe("increase page size", () => {
			const ORIG_PAGE_SIZE = 20;
			const NEW_PAGE_SIZE = 100;

			it("maps first page to the first page", () => {
				expect(new PageSizeAwareCounterCursor(JSON.stringify({
					pageNo: 1,
					perPage: ORIG_PAGE_SIZE
				}), NEW_PAGE_SIZE)).toEqual({
					pageNo: 1,
					perPage: NEW_PAGE_SIZE
				});
			});

			it("maps first pages to the first page if data hasn't been fetched yet for the scaled page", () => {
				expect(new PageSizeAwareCounterCursor(JSON.stringify({
					pageNo: 5, // only 4 small pages were fetched
					perPage: ORIG_PAGE_SIZE
				}), NEW_PAGE_SIZE)).toEqual({
					pageNo: 1,
					perPage: NEW_PAGE_SIZE
				});
			});

			it("maps to the second page as soon as the scaled page was fully fetched", () => {
				expect(new PageSizeAwareCounterCursor(JSON.stringify({
					pageNo: 6, // 5 small pages were fetched
					perPage: ORIG_PAGE_SIZE
				}), NEW_PAGE_SIZE)).toEqual({
					pageNo: 2,
					perPage: NEW_PAGE_SIZE
				});
			});

			it("maps to the second page if the whole first scaled page was fetched", () => {
				expect(new PageSizeAwareCounterCursor(JSON.stringify({
					pageNo: 6, // 5 small pages were fetched = 100 PRs => need to fetch 2nd scaled page
					perPage: ORIG_PAGE_SIZE
				}), NEW_PAGE_SIZE)).toEqual({
					pageNo: 2,
					perPage: NEW_PAGE_SIZE
				});
			});

			it("maps to the second page while the 2nd scaled page wasn't fully fetched", () => {
				expect(new PageSizeAwareCounterCursor(JSON.stringify({
					pageNo: 10, // 9 small pages were fetched = 180 PRs => still need to fetch 2nd scaled page
					perPage: ORIG_PAGE_SIZE
				}), NEW_PAGE_SIZE)).toEqual({
					pageNo: 2,
					perPage: NEW_PAGE_SIZE
				});
			});

			it("maps to the third page when the 2nd scaled page is fully fetched", () => {
				expect(new PageSizeAwareCounterCursor(JSON.stringify({
					pageNo: 11, // 10 small pages were fetched = 200 PRs => need to fetch 3rd page
					perPage: ORIG_PAGE_SIZE
				}), NEW_PAGE_SIZE)).toEqual({
					pageNo: 3,
					perPage: NEW_PAGE_SIZE
				});
			});
		});

		describe("decrease page size", () => {
			const ORIG_PAGE_SIZE = 100;
			const NEW_PAGE_SIZE = 20;

			it("maps first page to the first page", () => {
				expect(new PageSizeAwareCounterCursor(JSON.stringify({
					pageNo: 1,
					perPage: ORIG_PAGE_SIZE
				}), NEW_PAGE_SIZE)).toEqual({
					pageNo: 1,
					perPage: NEW_PAGE_SIZE
				});
			});

			it("skips first scaled pages when the original (large) page was processed", () => {
				expect(new PageSizeAwareCounterCursor(JSON.stringify({
					pageNo: 2, // 100 PRs were processed, which is 5 scaled pages. Must point to 6
					perPage: ORIG_PAGE_SIZE
				}), NEW_PAGE_SIZE)).toEqual({
					pageNo: 6,
					perPage: NEW_PAGE_SIZE
				});
			});
		});

		describe("same page size", () => {
			it("does nothing", () => {
				expect(new PageSizeAwareCounterCursor(JSON.stringify({
					pageNo: 1,
					perPage: 17
				}), 17)).toEqual({
					pageNo: 1,
					perPage: 17
				});

				expect(new PageSizeAwareCounterCursor(JSON.stringify({
					pageNo: 16,
					perPage: 17
				}), 17)).toEqual({
					pageNo: 16,
					perPage: 17
				});
			});
		});
	});

	describe("plain numbers provided", () => {
		it("ignores page size and uses 20", () => {
			expect(new PageSizeAwareCounterCursor(100, 33)).toEqual({
				pageNo: 100,
				perPage: 20
			});
		});

		it("maps empty string to page 1", () => {
			expect(new PageSizeAwareCounterCursor("", 33)).toEqual({
				pageNo: 1,
				perPage: 20
			});
		});
	});

	describe("copyWithPageNo", () => {
		it("correctly updates pageNo value", () => {
			expect(new PageSizeAwareCounterCursor(100, 20).copyWithPageNo(2)).toEqual({
				pageNo: 2,
				perPage: 20
			});
		});

		it("maps zero page to page 1", () => {
			expect(new PageSizeAwareCounterCursor(100, 20).copyWithPageNo(1)).toEqual({
				pageNo: 1,
				perPage: 20
			});
		});
	});

	describe("serialize", () => {
		it("round trips", () => {
			expect(new PageSizeAwareCounterCursor(new PageSizeAwareCounterCursor(100, 20).serialise(), 20)).toEqual({
				pageNo: 100,
				perPage: 20
			});
		});
	});
});

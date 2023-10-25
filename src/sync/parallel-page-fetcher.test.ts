import { fetchNextPagesInParallel } from "~/src/sync/parallel-page-fetcher";
import { PageSizeAwareCounterCursor } from "~/src/sync/page-counter-cursor";

describe("fetchNextPagesInParallel", () => {

	test("fetches data from multiple pages and merges the results", async () => {
		const singlePageFetchFactory = jest.fn().mockImplementation((pageCursor: PageSizeAwareCounterCursor) => {
			const edges = [{
				cursor: pageCursor.serialise(),
				node: { id: "id" + pageCursor.pageNo.toString() }
			}];
			const jiraPayload = {
				pullRequests: [{ id: "pid" + pageCursor.pageNo.toString() }],
				builds: [{ id: "bid" + pageCursor.pageNo.toString() }]
			};
			return Promise.resolve({ edges, jiraPayload });
		});
		const fetchedData = await fetchNextPagesInParallel(3, new PageSizeAwareCounterCursor("1"), singlePageFetchFactory);
		expect(fetchedData).toEqual({
			edges: [
				{ cursor: "{\"perPage\":20,\"pageNo\":1}", node: { id: "id1" } },
				{ cursor: "{\"perPage\":20,\"pageNo\":2}", node: { id: "id2" } },
				{ cursor: "{\"perPage\":20,\"pageNo\":3}", node: { id: "id3" } }
			],
			jiraPayload: {
				pullRequests: [{ id: "pid1" }, { id: "pid2" }, { id: "pid3" }],
				builds: [{ id: "bid1" }, { id: "bid2" }, { id: "bid3" }]
			}
		});
	});

	test("can fetch just one page", async () => {
		const singlePageFetchFactory = jest.fn().mockImplementation((pageCursor: PageSizeAwareCounterCursor) => {
			const edges = [{
				cursor: pageCursor.serialise(),
				node: { id: "id" + pageCursor.pageNo.toString() }
			}];
			const jiraPayload = {
				foo: "bar",
				pullRequests: [{ id: "pid" + pageCursor.pageNo.toString() }],
				builds: [{ id: "bid" + pageCursor.pageNo.toString() }]
			};
			return Promise.resolve({ edges, jiraPayload });
		});
		const fetchedData = await fetchNextPagesInParallel(1, new PageSizeAwareCounterCursor("1"), singlePageFetchFactory);
		expect(fetchedData).toEqual({
			edges: [
				{ cursor: "{\"perPage\":20,\"pageNo\":1}", node: { id: "id1" } }
			],
			jiraPayload: {
				foo: "bar",
				pullRequests: [{ id: "pid1" }],
				builds: [{ id: "bid1" }]
			}
		});
	});

	test("returns the first page if 2nd one is empty", async () => {
		const singlePageFetchFactory = jest.fn().mockImplementation((pageCursor: PageSizeAwareCounterCursor) => {
			if (pageCursor.pageNo == 2) {
				return Promise.resolve({
					edges: [],
					jiraPayload: undefined
				});
			}
			const edges = [{
				cursor: pageCursor.serialise(),
				node: { id: "id" + pageCursor.pageNo.toString() }
			}];
			const jiraPayload = { pullRequests: [{ id: "pid" + pageCursor.pageNo.toString() }] };
			return Promise.resolve({ edges, jiraPayload });
		});
		const fetchedData = await fetchNextPagesInParallel(2, new PageSizeAwareCounterCursor("1"), singlePageFetchFactory);
		expect(fetchedData).toEqual({
			edges: [
				{ cursor: "{\"perPage\":20,\"pageNo\":1}", node: { id: "id1" } }
			],
			jiraPayload: { pullRequests: [{ id: "pid1" }] }
		});
	});

	test("throws a error if any of the pages throws a error", async () => {
		const singlePageFetchFactory = jest.fn().mockImplementation((pageCursor: PageSizeAwareCounterCursor) => {
			if (pageCursor.pageNo == 2) {
				return Promise.reject(new Error("foo"));
			}
			const edges = [{
				cursor: pageCursor.serialise(),
				node: { id: "id" + pageCursor.pageNo.toString() }
			}];
			const jiraPayload = { pullRequests: [{ id: "pid" + pageCursor.pageNo.toString() }] };
			return Promise.resolve({ edges, jiraPayload });
		});
		await expect(fetchNextPagesInParallel(2, new PageSizeAwareCounterCursor("1"), singlePageFetchFactory)).rejects.toThrowError("foo");
	});

	test("returns empty page if both are empty", async () => {
		const singlePageFetchFactory = jest.fn().mockImplementation(() => {
			return Promise.resolve({
				edges: [],
				jiraPayload: undefined
			});
		});
		const fetchedData = await fetchNextPagesInParallel(2, new PageSizeAwareCounterCursor("1"), singlePageFetchFactory);
		expect(fetchedData).toEqual({
			edges: [ ],
			jiraPayload: undefined
		});
	});
});

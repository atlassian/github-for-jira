import { fetchNextPagesInParallel } from "~/src/sync/parallel-page-fetcher";

describe("fetchNextPagesInParallel", () => {

	test("fetches data from multiple pages and merges the results", async () => {
		const singlePageFetchFactory = jest.fn().mockImplementation((pageCursor) => {
			const edges = [{
				cursor: pageCursor,
				node: { id: "id" + pageCursor }
			}];
			const jiraPayload = {
				pullRequests: [{ id: "pid" + pageCursor }],
				builds: [{ id: "bid" + pageCursor }]
			};
			return Promise.resolve({ edges, jiraPayload });
		});
		const fetchedData = await fetchNextPagesInParallel(3, 1, singlePageFetchFactory);
		expect(fetchedData).toEqual({
			edges: [
				{ cursor: 1, node: { id: "id1" } },
				{ cursor: 2, node: { id: "id2" } },
				{ cursor: 3, node: { id: "id3" } }
			],
			jiraPayload: {
				pullRequests: [{ id: "pid1" }, { id: "pid2" }, { id: "pid3" }],
				builds: [{ id: "bid1" }, { id: "bid2" }, { id: "bid3" }]
			}
		});
	});

	test("can fetch just one page", async () => {
		const singlePageFetchFactory = jest.fn().mockImplementation((pageCursor) => {
			const edges = [{
				cursor: pageCursor,
				node: { id: "id" + pageCursor }
			}];
			const jiraPayload = {
				foo: "bar",
				pullRequests: [{ id: "pid" + pageCursor }],
				builds: [{ id: "bid" + pageCursor }]
			};
			return Promise.resolve({ edges, jiraPayload });
		});
		const fetchedData = await fetchNextPagesInParallel(1, 1, singlePageFetchFactory);
		expect(fetchedData).toEqual({
			edges: [
				{ cursor: 1, node: { id: "id1" } }
			],
			jiraPayload: {
				foo: "bar",
				pullRequests: [{ id: "pid1" }],
				builds: [{ id: "bid1" }]
			}
		});
	});

	test("returns the first page if 2nd one is empty", async () => {
		const singlePageFetchFactory = jest.fn().mockImplementation((pageCursor) => {
			if (pageCursor == 2) {
				return Promise.resolve({
					edges: [],
					jiraPayload: undefined
				});
			}
			const edges = [{
				cursor: pageCursor,
				node: { id: "id" + pageCursor }
			}];
			const jiraPayload = { pullRequests: [{ id: "pid" + pageCursor }] };
			return Promise.resolve({ edges, jiraPayload });
		});
		const fetchedData = await fetchNextPagesInParallel(2, 1, singlePageFetchFactory);
		expect(fetchedData).toEqual({
			edges: [
				{ cursor: 1, node: { id: "id1" } }
			],
			jiraPayload: { pullRequests: [{ id: "pid1" }] }
		});
	});

	test("throws a error if any of the pages throws a error", async () => {
		const singlePageFetchFactory = jest.fn().mockImplementation((pageCursor) => {
			if (pageCursor == 2) {
				return Promise.reject(new Error("foo"));
			}
			const edges = [{
				cursor: pageCursor,
				node: { id: "id" + pageCursor }
			}];
			const jiraPayload = { pullRequests: [{ id: "pid" + pageCursor }] };
			return Promise.resolve({ edges, jiraPayload });
		});
		await expect(fetchNextPagesInParallel(2, 1, singlePageFetchFactory)).rejects.toThrowError("foo");
	});

	test("returns empty page if both are empty", async () => {
		const singlePageFetchFactory = jest.fn().mockImplementation(() => {
			return Promise.resolve({
				edges: [],
				jiraPayload: undefined
			});
		});
		const fetchedData = await fetchNextPagesInParallel(2, 1, singlePageFetchFactory);
		expect(fetchedData).toEqual({
			edges: [ ],
			jiraPayload: undefined
		});
	});
});

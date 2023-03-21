import { TaskResultPayload } from "~/src/sync/sync.types";

const mergeJiraPayload = (jiraPayload1?: any, jiraPayload2?: any) => {
	if (!jiraPayload1 && !jiraPayload2) {
		return undefined;
	}

	// TODO: add more
	const pullRequests = [...(jiraPayload1?.pullRequests || []), ...(jiraPayload2?.pullRequests || [])];
	const builds = [...(jiraPayload1?.builds || []), ...(jiraPayload2?.builds || [])];

	if (pullRequests.length === 0 && builds.length === 0) {
		return undefined;
	}

	return {
		...(jiraPayload1 || jiraPayload2),
		...(pullRequests.length > 0 ? { pullRequests } : {}),
		...(builds.length > 0 ? { builds } : {})
	};
};

export const fetchNextPagesInParallel = async (
	pagesToFetch: number,
	nextPageCursor: number,
	singlePageFetchFactory: (pageCursor: number) => Promise<TaskResultPayload>
): Promise<TaskResultPayload> => {
	const tasks = Array.from(
		{
			length: pagesToFetch
		},
		(_, index) => singlePageFetchFactory(nextPageCursor + index)
	);
	const fetchedData = await Promise.allSettled(tasks);
	const emptyValue: TaskResultPayload = {
		edges: [],
		jiraPayload: undefined
	};
	return fetchedData.reduce((prev, curr) => {
		if (curr.status === "fulfilled") {
			const page: TaskResultPayload = curr.value;
			return {
				edges: [...(prev.edges || []), ...(page.edges || [])],
				jiraPayload:
					mergeJiraPayload(prev.jiraPayload, page.jiraPayload)
			};
		} else {
			throw curr.reason;
		}
	}, emptyValue);
};

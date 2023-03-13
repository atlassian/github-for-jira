import { TaskPayload } from "~/src/sync/sync.types";

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
		... (pullRequests.length > 0 ? { pullRequests } : {}),
		... (builds.length > 0 ? { builds } : {})
	};
};

export const fetchNextPagesInParallel = async (
	pagesToFetch: number,
	nextPageCursor: number,
	singlePageFetchFactory: (pageCursor: number) => Promise<TaskPayload>
): Promise<TaskPayload> => {
	const tasks = Array.from(
		{
			length: pagesToFetch
		},
		(_, index) => singlePageFetchFactory(nextPageCursor + index)
	);
	const fetchedData = await Promise.all(tasks);
	return fetchedData.reduce((prev, curr) => {
		return {
			edges: [...(prev.edges || []), ...(curr.edges || [])],
			jiraPayload:
				mergeJiraPayload(prev.jiraPayload, curr.jiraPayload)
		};
	}, {
		edges: [],
		jiraPayload: undefined
	});
};

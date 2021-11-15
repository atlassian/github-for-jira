export enum SortDirection {
	ASC = "asc",
	DES = "desc"
}
export enum PullRequestState {
	OPEN = "open",
	CLOSED = "closed",
	ALL = "all"
}
export enum PullRequestSort {
	CREATED = 'created',
	UPDATED = 'updated',
	POPULARITY = 'popularity',
	LONG_RUNNING = 'long-running',
}

export type GetPullRequestParams = {
	state?: string;
	head?: string;
	base?: string;
	sort?: string;
	direction?: string;
	per_page?: number;
	page?: number;
}

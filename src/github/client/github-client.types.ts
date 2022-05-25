import { AxiosResponse } from "axios";
import { Octokit } from "probot";
import { GraphQLError } from "./github-client-errors";

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
	CREATED = "created",
	UPDATED = "updated",
	POPULARITY = "popularity",
	LONG_RUNNING = "long-running",
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

export type GraphQlQueryResponse<ResponseData> = {
	data: ResponseData;
	errors?: GraphQLError[];
};

export type PaginatedAxiosResponse<T> = { hasNextPage: boolean; } & AxiosResponse<T>;

export type ActionsListRepoWorkflowRunsResponseEnhanced = Octokit.ActionsListRepoWorkflowRunsResponse & {name: string};
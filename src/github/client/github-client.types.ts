import { AxiosResponse } from "axios";
import { GraphQLError } from "./github-client-errors";
import { Octokit } from "@octokit/rest";

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

export type GetSecretScanningAlertRequestParams = {
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
export interface ReposGetContentsResponse {
	content?: string;
	download_url: string | null;
	encoding?: string;
	git_url: string;
	html_url: string;
	name: string;
	path: string;
	sha: string;
	size: number;
	type: string;
	url: string;
}

export type ActionsListRepoWorkflowRunsResponseEnhanced = Octokit.ActionsListRepoWorkflowRunsResponse & {name: string};


export type CreateReferenceBody = {
	owner: string,
	repo: string,
	ref: string,
	sha: string
}

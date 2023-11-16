import { AxiosResponse } from "axios";
import { GraphQLError } from "./github-client-errors";
import { Octokit } from "@octokit/rest";
import { JiraAuthor } from "~/src/interfaces/jira";

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

export type GetCodeScanningAlertRequestParams = {
	sort?: string;
	direction?: string;
	per_page?: number;
	page?: number;
	state?: "open" | "closed" | "dismissed" | "fixed";
	severity?: "critical" | "high" | "medium" | "low" | "warning" | "note" | "error"
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

export type ActionsListRepoWorkflowRunsResponseEnhanced =
	Octokit.ActionsListRepoWorkflowRunsResponse
	& { name: string };


export type CreateReferenceBody = {
	owner: string,
	repo: string,
	ref: string,
	sha: string
}

export type GetDependabotAlertRequestParams = {
	sort?: string;
	direction?: string;
	per_page?: number;
	page?: number;
}


export type DependabotAlertResponseItem = {
	number: number,
	created_at: string,
	updated_at: string,
	dismissed_at?: string,
	auto_dismissed_at?: string,
	fixed_at?: string,
	url: string,
	html_url: string,
	state: "auto_dismissed" | "dismissed" | "fixed" | "open",
	security_advisory: {
		summary: string,
		description: string,
		identifiers: { type: string, value: string }[],
		references: { url: string }[],
		severity: string,
		cvss: {
			score?: number
		}
	},
	security_vulnerability: {
		severity: string,
		first_patched_version: {
			identifier: number
		}
	},
	dependency: {
		scope: string,
		manifest_path: string
	}
}

export type SecretScanningAlertResponseItem = {
	number: number,
	created_at: string,
	updated_at?: string,
	url: string,
	html_url: string,
	locations_url: string,
	state: "open" | "resolved",
	resolution?: string,
	resolved_at?: string,
	resolution_comment?: string,
	secret_type: string,
	secret_type_display_name: string
}

export type CodeScanningAlertResponseItem = {
	number: number;
	created_at: string;
	updated_at: string;
	url: string;
	html_url: string;
	instances_url: string;
	state: "open" | "dismissed" | "fixed";
	fixed_at: string;
	dismissed_at: string;
	dismissed_reason: null | "false positive" | "won't fix" | "used in tests";
	dismissed_comment: string;
	rule: CodeScanningAlertResponseItemRule;
	tool: CodeScanningAlertResponseItemTool;
	most_recent_instance: CodeScanningAlertResponseItemMostRecentInstance;
};

export interface Commit {
	author: JiraAuthor;
	authoredDate: string;
	message: string;
	oid: string;
	url: string;
}

export interface Branch {
	associatedPullRequests: {
		nodes: {
			title: string;
		}[];
	};
	name: string;
	target: {
		author: {
			avatarUrl: string;
			email: string;
			name: string;
		};
		authoredDate: string;
		changedFiles: number;
		oid: string;
		message: string;
		url: string;
		history: {
			nodes: Commit[];
		}
	};
}

type CodeScanningAlertResponseItemRule = {
	name: string;
	description: string;
	full_description: string;
	id: string | null;
	tags: string[] | null;
	severity: "none" | "note" | "warning" | "error" | null;
	security_severity_level: "low" | "medium" | "high" | "critical" | null;
	help: string | null;
	help_uri: string | null;
};

type CodeScanningAlertResponseItemTool = {
	name: string;
	version: string | null;
	guid: string | null;
}

type CodeScanningAlertResponseItemMostRecentInstance = {
	ref: string;
	environment: string;
	category: string;
	state: string;
	commit_sha: string;
	html_url: string;
}

import { WorkflowRunRepository } from '../config/interfaces';
export interface JiraPullRequest {
	commit: {
		id: string;
		repositoryUri: string;
	};
	ref: {
		name: string;
		uri: string;
	};
}

export interface JiraBuild {
	schemaVersion: string;
	pipelineId: string;
	buildNumber: number;
	updateSequenceNumber: number;
	displayName: string;
	url: string;
	state: string;
	lastUpdated: string;
	issueKeys: string[];
	references?: JiraPullRequest[];
}

export interface JiraBuildData {
	product: string;
	builds: JiraBuild[];
}

export interface JiraBranch {
	createPullRequestUrl: string,
	lastCommit: JiraCommit,
	id: string,
	issueKeys: string[],
	name: string,
	url: string,
	updateSequenceId: number
}

export interface JiraBranchData {
	id: number,
	name: string,
	url: string,
	branches: JiraBranch[],
	updateSequenceId: number
}

export interface JiraCommit {
	author: JiraAuthor;
	authorTimestamp: string;
	displayId: string;
	fileCount: number;
	hash: string;
	id: string;
	issueKeys: string[];
	message: string;
	url: string;
	updateSequenceId: number;

	files?: JiraCommitFile[];
	flags?: string[];
}

export interface JiraIssue {
	id: string;
	self: string;
	key: string;
	fields: {
		summary: string;
	};
}

export interface JiraCommitFile {
	path: string;
	changeType: string;
	linesAdded?: string[];
	linesRemoved?: string[];
	url: string;
}

export interface JiraAuthor {
	avatar?: string;
	email: string;
	name: string;
	url?: string;
}
export interface Review extends JiraAuthor {
	approvalStatus: string;
}

export interface JiraCommitData {
	commits: JiraCommit[];
	id: string;
	name: string;
	url: string;
	updateSequenceId: number;
}

export interface JiraDeployment {
	schemaVersion: string;
	deploymentSequenceNumber: number;
	updateSequenceNumber: number;
	issueKeys: string[],
	displayName: string;
	url: string;
	description: string;
	lastUpdated: Date;
	state: string;
	pipeline: {
		id: string;
		displayName: string;
		url: string;
	},
	environment: {
		id: string;
		displayName: string;
		type: string;
	},
}

export interface JiraDeploymentData {
	deployments: JiraDeployment[];
}


interface PullRequests {
	author: JiraAuthor;
	commentCount: number;
	destinationBranch: string;
	displayId: string;
	id: number;
	issueKeys: string[];
	lastUpdate: string;
	reviewers: Review[];
	sourceBranch: string;
	sourceBranchUrl: string;
	status: string;
	timestamp: string;
	title: string;
	url: string;
	updateSequenceId: number;
}

interface Branches {
	createPullRequestUrl: string;
	lastCommit: {
		author: JiraAuthor;
		authorTimestamp: string;
		displayId: string;
		fileCount: number;
		hash: string;
		id: string;
		issueKeys: string[];
		message: string;
		updateSequenceId: number;
		url: string;
	};
	id: string;
	issueKeys: string[];
	name: string;
	url: string;
	updateSequenceId: number;
}

export interface JiraPullRequestData {
	id: number;
	name: string;
	url: string;
	branches: Branches[];
	pullRequests: PullRequests[];
	updateSequenceId: number;
}

interface Repository extends WorkflowRunRepository {
	created_at: number;
	updated_at: string;
	pushed_at: number;
	git_url: string;
	ssh_url: string;
	clone_url: string;
	svn_url: string;
	homepage?: string;
	size: number;
	stargazers_count: number;
	watchers_count: number;
	language?: string;
	has_issues: boolean;
	has_projects: boolean;
	has_downloads: boolean;
	has_wiki: boolean;
	has_pages: boolean;
	forks_count: number;
	mirror_url?: string;
	archived: boolean;
	disabled: boolean;
	open_issues_count: number;
	license?: string;
	allow_forking: boolean;
	is_template: boolean;
	topics: string[];
	visibility: string;
	forks: number;
	open_issues: number;
	watchers: number;
	default_branch: string;
	stargazers: number;
	master_branch: string;
}

interface Installation {
	id: number;
	node_id: number;
}

export interface JiraPushData {
	webhookId: string;
	webhookReceived: number;
	repository: Repository;
	commits: string[];
	installation: Installation;
}

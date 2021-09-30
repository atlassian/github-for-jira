export interface JiraBuildReference {
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
	references?: JiraBuildReference[];
}

export interface JiraBuildData {
	product: string;
	builds: JiraBuild[];
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
	url?: string;
	updateSequenceId: number;
	files?: JiraCommitFile[];
	flags?: string[];
}

export interface JiraCommitFile {
	path: string;
	changeType: "ADDED" | "COPIED" | "DELETED" | "MODIFIED" | "MOVED" | "UNKNOWN";
	linesAdded: number;
	linesRemoved: number;
	url: string;
}

export interface JiraIssue {
	id: string;
	self: string;
	key: string;
	fields:{
		summary: string;
	};
}

export interface JiraAuthor {
	avatar?: string;
	email: string;
	name: string;
	url?: string;
}

export interface JiraCommitData {
	commits: JiraCommit[];
	id: string;
	name: string;
	url: string;
	updateSequenceId: number;
}

export interface JiraBranch {
	id: string;
	createPullRequestUrl?: string;
	issueKeys: string[];
	name: string;
	url: string;
	updateSequenceId: number;
	lastCommit: JiraCommit;
}

export interface JiraDeployment {
	schemaVersion: string;
	deploymentSequenceNumber: number;
	updateSequenceNumber: number;
	issueKeys: string[],
	displayName: string;
	url: string;
	description: string;
	lastUpdated: number;
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

export interface JiraPullRequest {
	author: JiraAuthor;
	commentCount: number;
	displayId: string;
	id: string;
	issueKeys: string[];
	lastUpdate: string;
	sourceBranch: string;
	sourceBranchUrl: string;
	destinationBranch: string;
	status: JiraPullRequestStatus;
	timestamp: string;
	title: string;
	url: string;
	updateSequenceId: number;
}

export type JiraPullRequestStatus = "MERGED" | "OPEN" | "DECLINED" | "UNKNOWN";

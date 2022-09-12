interface JiraPullRequestCommit {
	id: string;
	repositoryUri: string;
}

interface JiraPullRequestRef {
	name: string;
	uri: string;
}

export interface JiraPullRequestHead {
	commit: JiraPullRequestCommit;
	ref: JiraPullRequestRef;
}

interface JiraPullRequest {
	author: JiraAuthor;
	commentCount: number;
	destinationBranch: string;
	displayId: string;
	id: number;
	issueKeys: string[];
	lastUpdate: string;
	reviewers: JiraReview[];
	sourceBranch: string;
	sourceBranchUrl: string;
	status: string;
	timestamp: string;
	title: string;
	url: string;
	updateSequenceId: number;
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
	references?: JiraPullRequestHead[];
}

export interface JiraBuildData {
	product: string;
	builds: JiraBuild[];
}

export interface JiraBranch {
	createPullRequestUrl?: string;
	lastCommit: JiraCommit;
	id: string;
	issueKeys: string[];
	name: string;
	url: string;
	updateSequenceId: number;
}

export interface JiraBranchData {
	id: string;
	name: string;
	url: string;
	branches: JiraBranch[];
	updateSequenceId: number;
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
	changeType: JiraCommitFileChangeTypeEnum;
	linesAdded: number;
	linesRemoved: number;
	url: string;
}

export enum JiraCommitFileChangeTypeEnum {
	ADDED,
	COPIED,
	DELETED,
	MODIFIED,
	MOVED,
	UNKNOWN
}

export interface JiraAuthor {
	avatar?: string;
	email: string;
	name: string;
	url?: string;
}
export interface JiraReview extends JiraAuthor {
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
	displayName: string;
	url: string;
	description: string;
	lastUpdated: Date;
	state: string;
	pipeline: {
		id: string;
		displayName: string;
		url: string;
	};
	environment: {
		id: string;
		displayName: string;
		type: string;
	};
	associations: JiraAssociation[];
}

export interface JiraDeploymentData {
	deployments: JiraDeployment[];
}

export interface JiraPullRequestData {
	id: number;
	name: string;
	url: string;
	branches: JiraBranch[];
	pullRequests: JiraPullRequest[];
	updateSequenceId: number;
}

export interface JiraAssociation {
	associationType: "issueKeys" | "issueIdOrKeys" | "commit";
	values: string[] | JiraCommitKey[];
}

export interface JiraCommitKey {
	commitHash: string;
	repositoryId: string;
}

export interface JiraRemoteLinkData {
	remoteLinks: JiraRemoteLink[];
}

export interface JiraRemoteLink {
	id: string;
	schemaVersion: string;
	updateSequenceNumber: number;
	associations: JiraAssociation[];
	displayName: string;
	description: string;
	url: string;
	type: string;
	status: JiraRemoteLinkStatus;
	lastUpdated: number;
}

export interface JiraRemoteLinkStatus {
	appearance: JiraRemoteLinkStatusAppearance;
	label: string;
}

// These align with Atlaskit's lozenge values:
// https://atlassian.design/components/lozenge/examples
export type JiraRemoteLinkStatusAppearance = "default" | "inprogress" | "moved" | "new" | "removed" | "prototype" | "success";

export type JiraOperationType = "NORMAL" | "BACKFILL"

export interface JiraSubmitOptions {
	preventTransitions: boolean;
	operationType: JiraOperationType;
}

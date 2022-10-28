import { TransformedRepositoryId } from "~/src/transforms/transform-repository-id";

interface JiraPullRequestCommit {
	id: string;
	repositoryUri: string;
}

interface JiraPullRequestRef {
	name: string;
	uri: string;
}

export interface BulkSubmitRepositoryInfo {
	id: TransformedRepositoryId;
	name: string;
	url: string;
	updateSequenceId: number;
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

export interface JiraBuildBulkSubmitData {
	product: string; // TODO: doesn't match with data depot API docs (must be under providerMetadata), check with Saiyans
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

export interface JiraBranchBulkSubmitData {
	branches: JiraBranch[];
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
export interface JiraSubmitDeploymentsResponse {
	deploymentSequenceNumber: number,
	pipelineId: string,
	environmentId: string,
	updatedTimestamp: string,
	gatingStatus: JiraGatingStatusTypeEnum,
	details?: JiraSubmitDeploymentsResponseDetail[]
}

export enum JiraGatingStatusTypeEnum {
	ALLOWED = "allowed",
	PREVENTED = "prevented",
	AWAING = "awaiting",
	INVALID = "invalid"
}

export interface JiraSubmitDeploymentsResponseDetail {
	type: string,
	issueKey: string,
	issueLink: string
}

export interface JiraCommitFile {
	path: string;
	changeType: JiraCommitFileChangeTypeEnum;
	linesAdded: number;
	linesRemoved: number;
	url: string;
}

export enum JiraCommitFileChangeTypeEnum {
	ADDED = "ADDED",
	COPIED = "COPIED",
	DELETED = "DELETED",
	MODIFIED = "MODIFIED",
	MOVED = "MOVED",
	UNKNOWN = "UNKNOWN"
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

export interface JiraCommitBulkSubmitData extends BulkSubmitRepositoryInfo {
	commits: JiraCommit[];
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

export interface JiraDeploymentBulkSubmitData {
	deployments: JiraDeployment[];
}

export interface JiraPullRequestBulkSubmitData extends BulkSubmitRepositoryInfo {
	branches: JiraBranch[];
	pullRequests: JiraPullRequest[];
}

export interface JiraAssociation {
	associationType: "issueKeys" | "issueIdOrKeys" | "commit" | "serviceIdOrKeys";
	values: string[] | JiraCommitKey[];
}

export interface JiraCommitKey {
	commitHash: string;
	repositoryId: TransformedRepositoryId;
}

export interface JiraRemoteLinkBulkSubmitData {
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

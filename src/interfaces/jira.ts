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

export interface JiraIssueComments {
	startAt: number;
	maxResults: number;
	total: number;
	comments: JiraIssueComment[];
}

export interface JiraEntityProperty {
	key: string;
	value: any;
}

export interface JiraIssueVisibility {
	identifier?: string;
	type: "group" | "role";
	value: string;
}

export interface JiraIssueCommentPayload {
	visibility?: JiraIssueVisibility;
	properties?: JiraEntityProperty[];
	body: string;
}

export interface JiraIssueTransitions {
	transitions?: JiraIssueTransition[];
	expand?: string;
}

export interface JiraIssueTransition {
	id: string;
	name?: string;
	to?: {
		self?: string;
		description?: string;
		iconUrl?: string;
		name?: string;
		id?: string;
		statusCategory?: {
			self?: string;
			id?: number;
			key?: string;
			colorName?: string;
		}
	};
	hasScreen?: boolean;
	isGlobal?: boolean;
	isInitial?: boolean;
	isAvailable?: boolean;
	isConditional?: boolean;
	expand?: string;
	looped?: boolean;
	fields?: {
		[key: string]: {
			required: boolean,
			schema: {
				type: string;
				items?: string;
				system?: string;
				custom?: string;
				customId?: number;
			},
			name: string;
			key: string;
			operations: string[];
			autoCompleteUrl?: string;
			hasDefaultValue?: boolean;
			allowedValues?: any[];
			defaultValue?: any;
		};
	};
}

export interface JiraIssueWorklogPayload {
	timeSpent?: string;
	timeSpentSeconds?: number;
	visibility?: JiraIssueVisibility;
	comment?: string;
	started?: Date;
}

export interface JiraIssueWorklog {
	self: string;
	author: JiraUserDetails;
	updateAuthor: JiraUserDetails;
	comment: string;
	created: Date;
	updated: Date;
	visibility: JiraIssueVisibility;
	started: Date;
	timeSpent: string;
	timeSpentSeconds: number;
	id: string;
	issueId: string;
	properties: JiraEntityProperty[];
}

export interface JiraIssueComment {
	"self": "https://your-domain.atlassian.net/rest/api/2/issue/10010/comment/10000",
	"id": "10000",
	"author": {
		"self": "https://your-domain.atlassian.net/rest/api/2/user?accountId=5b10a2844c20165700ede21g",
		"accountId": "5b10a2844c20165700ede21g",
		"displayName": "Mia Krystof",
		"active": false
	},
	"body": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque eget venenatis elit. Duis eu justo eget augue iaculis fermentum. Sed semper quam laoreet nisi egestas at posuere augue semper.",
	"updateAuthor": {
		"self": "https://your-domain.atlassian.net/rest/api/2/user?accountId=5b10a2844c20165700ede21g",
		"accountId": "5b10a2844c20165700ede21g",
		"displayName": "Mia Krystof",
		"active": false
	},
	"created": "2021-01-17T12:34:00.000+0000",
	"updated": "2021-01-18T23:45:00.000+0000",
	"visibility": {
		"type": "role",
		"value": "Administrators",
		"identifier": "Administrators"
	}
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

export interface JiraUserDetails {
	self: string;
	accountId: string;
	emailAddress?: string;
	avatarUrls: {
		"16x16": string;
		"32x32": string;
		"48x48": string;
		"64x64": string;
	};
	displayName: string;
	active: boolean;
	timeZone: string;
	accountType: "atlassian" | "app" | "customer";
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
	associationType: "issueKeys" | "issueIdOrKeys" | "commit";
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

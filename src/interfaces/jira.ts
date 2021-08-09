export interface JiraPullRequest {
	commit: {
		id: string;
		repositoryUri: string;
	};
	ref: {
		name: string;
		uri: string;
	}
}

export interface Build {
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

export interface BuildData {
	product: string;
	builds: Build[];
}

export interface Commit {
	author: {
		avatar?: string;
		email: string;
		name: string;
		url?: string;
	};
	authorTimestamp: number;
	displayId: string;
	fileCount: number;
	hash: string;
	id: string;
	issueKeys: string[];
	message: string;
	timestamp: number;
	url: string;
	updateSequenceId: number;
}

export interface CommitData {
	commits: Commit[];
	id: string;
	name: string;
	url: string;
	updateSequenceId: number;
}

import { RepositoryData } from "../models/subscription";

export type JobId = {
	installationId: number;
	jiraHost: string;
}

/**
 * The JobState contains the state of only one repository. This is the repository that should be processed in the
 * next step of the job. The JobStore implementation that is responsible for loading the
 * JobState from the database must choose which repository is the next to be worked on (for example by sorting them
 * by the last updated date to pick the one that was not updated for the longest time).
 */
export type JobState = {
	installationId: number;
	jiraHost: string;
	numberOfSyncedRepos?: number;
	repository: RepositoryData;
}

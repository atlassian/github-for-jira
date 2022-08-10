import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import Logger from "bunyan";

/* valid task types */
export type TaskType = "repository" | "pull" | "commit" | "branch" | "build" | "deployment";

export interface TaskProcessors {
	[task: string]: (
		logger: Logger,
		gitHubInstallationClient: GitHubInstallationClient,
		jiraHost: string,
		repository: Repository,
		cursor?: string | number,
		perPage?: number,
		messagePayload?: BackfillMessagePayload
	) => Promise<TaskPayload>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TaskPayload<E = any, P = any> {
	edges?: E[];
	jiraPayload?: P;
}

export interface Task {
	task: TaskType;
	repositoryId: number;
	repository: Repository;
	cursor?: string | number;
}

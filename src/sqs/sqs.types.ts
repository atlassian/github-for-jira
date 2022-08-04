import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import type { WebhookPayloadCreate } from "@octokit/webhooks";
import type { TaskType } from "~/src/sync/sync.types";

export type BranchMessagePayload = {
	jiraHost: string,
	installationId: number,
	gitHubAppConfig?: GitHubAppConfig, //undefined for cloud
	webhookReceived: number,
	webhookId: string,

	// The original webhook payload from GitHub. We don't need to worry about the SQS size limit because metrics show
	// that payload size for deployment_status webhooks maxes out at 9KB.
	webhookPayload: WebhookPayloadCreate,
}

export type BackfillMessagePayload = {
	jiraHost: string,
	installationId: number,
	gitHubAppConfig?: GitHubAppConfig, //undefined for cloud
	startTime?: string,
	commitsFromDate?: string,
	targetTasks?: TaskType[]
}

export type DeploymentMessagePayload = {
	jiraHost: string,
	installationId: number,
	gitHubAppConfig?: GitHubAppConfig, //undefined for cloud
	webhookReceived: number,
	webhookId: string,

	// The original webhook payload from GitHub. We don't need to worry about the SQS size limit because metrics show
	// that payload size for deployment_status webhooks maxes out at 13KB.
	webhookPayload: WebhookPayloadDeploymentStatus,
}

export type PushQueueMessagePayload = {
	jiraHost: string,
	installationId: number,
	gitHubAppConfig?: GitHubAppConfig, //undefined for cloud
	repository: PayloadRepository,
	shas: { id: string, issueKeys: string[] }[],
	webhookId: string,
	webhookReceived?: number,
}

export type GitHubAppConfig = {
	gitHubAppId: number,
	appId: number,
	clientId: string,
	gitHubBaseUrl: string,
	uuid: string,
	//gitHubClientSecret: string,
	//webhookSecret: string,
	//privateKey: string
}

//refer from https://docs.github.com/en/rest/repos/repos#get-a-repository
type PayloadRepository = {
	id: number,
	name: string,
	full_name: string,
	html_url: string,
	owner: { login: string },
}


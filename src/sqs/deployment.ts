import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";

export type DeploymentMessagePayload = {
	jiraHost: string,

	// The original webhook payload from GitHub. We don't need to worry about the SQS size limit because metrics show
	// that payload size for deployment_status webhooks maxes out at 13KB.
	webhookPayload: WebhookPayloadDeploymentStatus
}

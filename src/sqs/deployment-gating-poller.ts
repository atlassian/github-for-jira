import { getJiraClient } from "../jira/client/jira-client";
import { JiraGatingStatusTypeEnum } from "interfaces/jira";
import { DeploymentGatingPollerMessagePayload, MessageHandler, SQSMessageContext } from "./sqs.types";
import { sqsQueues } from "~/src/sqs/queues";
import { createInstallationClient, createUserClient } from "utils/get-github-client-config";
import { ReviewPendingWorkflowRunParams } from "~/src/github/client/github-client.types";

export const deploymentGatingPollerQueueMessageHandler: MessageHandler<DeploymentGatingPollerMessagePayload> = async (context: SQSMessageContext<DeploymentGatingPollerMessagePayload>) => {
	const messagePayload: DeploymentGatingPollerMessagePayload = context.payload;
	const { webhookId, jiraHost, installationId } = messagePayload;
	const { githubDeployment, githubDeploymentStatus, githubRepository, jiraEnvironmentId, deploymentGatingConfig, currentRetry } = messagePayload.webhookPayload;

	context.log = context.log.child({
		webhookId,
		jiraHost,
		gitHubInstallationId: installationId
	});

	const jiraClient = await getJiraClient(
		jiraHost,
		installationId,
		messagePayload.gitHubAppId,
		context.log
	);

	const result = (await jiraClient.deploymentGating.get(githubDeployment.task, jiraEnvironmentId, githubDeployment.id))
		.data;

	context.log.error("Gating Status: " + result.gatingStatus);
	if (result.gatingStatus === JiraGatingStatusTypeEnum.AWATING && currentRetry < deploymentGatingConfig.totalRetryCount) {
		context.payload.webhookPayload.currentRetry += 1;
		(await sqsQueues.deploymentGatingPoller.sendMessage(context.payload, deploymentGatingConfig.sleep));
	} else {
		const target_url_list = githubDeploymentStatus.target_url.split("/");
		const run_id = target_url_list[target_url_list.indexOf("runs")+1];
		context.log.error("InstallationId: "+ installationId);
		context.log.error("GitHubAppId: " + messagePayload.gitHubAppId);
		const client = await createUserClient(installationId, jiraHost, context.log, messagePayload.gitHubAppId);
		githubRepository.owner.name = "kaganatlassian2";
		const environmentId = (await client.getEnvironmentId(githubRepository.owner.name, githubRepository.name, githubDeploymentStatus.environment));
		if (environmentId != undefined) {
			if (result.gatingStatus === JiraGatingStatusTypeEnum.ALLOWED) {
				const data: ReviewPendingWorkflowRunParams = {
					comment: "Deployment has been approved by JSM",
					state: "approved",
					environment_ids: [environmentId]
				};
				context.log.warn(JSON.stringify(data));
				(await client.reviewPendingDeploymentsForWorkflowRun(githubRepository.owner.name, githubRepository.name, run_id, data));
			} else {
				await client.reviewPendingDeploymentsForWorkflowRun(githubRepository.owner.name, githubRepository.name, run_id, {
					environment_ids: [environmentId],
					state: "rejected",
					comment: "Deployment has been rejected by JSM"
				});
			}
		}
	}
};

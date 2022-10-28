// import { workerApp } from "../worker/app";
// import { createInstallationClient } from "~/src/util/get-github-client-config";
import { getJiraClient } from "../jira/client/jira-client";
import { JiraSubmitDeploymentsResponse, JiraGatingStatusTypeEnum } from "interfaces/jira";
import { DeploymentGatingPollerMessagePayload, MessageHandler, SQSMessageContext } from "./sqs.types";

export const deploymentGatingPollerQueueMessageHandler: MessageHandler<DeploymentGatingPollerMessagePayload> = async (context: SQSMessageContext<DeploymentGatingPollerMessagePayload>) => {
	const messagePayload: DeploymentGatingPollerMessagePayload = context.payload;
	const { webhookId, jiraHost, installationId } = messagePayload;
	const { githubDeployment, repository, jiraEnvironmentId, deploymentGatingConfig, currentRetry } = messagePayload.webhookPayload;

	context.log = context.log.child({
		webhookId,
		jiraHost,
		gitHubInstallationId: installationId
	});

	//console.log(repository);
	context.log.error(repository, deploymentGatingConfig, currentRetry);

	context.log.info("Handling deployment message from the SQS queue");

	const jiraClient = await getJiraClient(
		jiraHost,
		installationId,
		messagePayload.gitHubAppConfig?.gitHubAppId,
		context.log
	);

	const result: JiraSubmitDeploymentsResponse = await jiraClient.deploymentGating.get(githubDeployment.task, jiraEnvironmentId, githubDeployment.id);

	if (result.gatingStatus === JiraGatingStatusTypeEnum.ALLOWED) {
		//console.log(deploymentGatingConfig);
	} else if (result.gatingStatus === JiraGatingStatusTypeEnum.INVALID || result.gatingStatus === JiraGatingStatusTypeEnum.PREVENTED) {
		//console.log(deploymentGatingConfig);
	} else {
		//console.log(currentRetry);
	}

	// const github = await workerApp.auth(installationId);
	// const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, context.log, messagePayload.gitHubAppConfig?.gitHubAppId);

	// gitHubInstallationClient.reviewPendingDeploymentsForWorkflowRun(
	// 	repository.owner.id,
	// 	repository.id,

	// )

};

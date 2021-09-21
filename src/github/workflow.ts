import transformWorkflow from "../transforms/workflow";
import { CustomContext } from "./middleware";
import { calculateProcessingTimeInSeconds } from "../util/time";

export default async (context: CustomContext, jiraClient): Promise<void> => {
	const jiraPayload = transformWorkflow(context);

	if (!jiraPayload) {
		context.log({noop: "no_jira_payload_workflow_run"}, "Halting further execution for workflow since jiraPayload is empty");
		return;
	}

	context.log(`Sending workflow event to Jira: ${jiraClient.baseURL}`)
	await jiraClient.workflow.submit(jiraPayload);

	calculateProcessingTimeInSeconds(context.webhookReceived, context.name);
};


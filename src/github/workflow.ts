import transformWorkflow from "../backend/transforms/workflow";
import { Context } from "probot/lib/context";

export default async (context: Context, jiraClient): Promise<void> => {
	const jiraPayload = await transformWorkflow(context);

	if (!jiraPayload) {
		context.log({noop: "no_jira_payload_workflow_run"}, "Halting further execution for workflow since jiraPayload is empty");
		return;
	}

	await jiraClient.workflow.submit(jiraPayload);
};

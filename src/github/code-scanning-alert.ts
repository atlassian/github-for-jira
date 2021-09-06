import transformCodeScanningAlert from "../transforms/code-scanning-alert";
import { Context } from "probot/lib/context";

export default async (context: Context, jiraClient): Promise<void> => {
	const jiraPayload = await transformCodeScanningAlert(context);

	if (!jiraPayload) {
		context.log({noop: "no_jira_payload_code_scanning_alert"}, "Halting further execution for code scanning alert since jiraPayload is empty");
		return;
	}

	context.log(`Sending code scanning alert event as Remote Link to Jira: ${jiraClient.baseURL}`)
	//todo add jira module
	//await jiraClient.workflow.submit(jiraPayload);
};

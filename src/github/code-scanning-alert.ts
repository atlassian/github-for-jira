import transformCodeScanningAlert from "../transforms/code-scanning-alert";
import { Context } from "probot/lib/context";

export default async (context: Context, jiraClient): Promise<void> => {
	const jiraPayload = await transformCodeScanningAlert(context);

	if (!jiraPayload) {
		context.log.info({noop: "no_jira_payload_code_scanning_alert"}, "Halting further execution for code scanning alert since jiraPayload is empty");
		return;
	}

	context.log.info(`Sending code scanning alert event as Remote Link to Jira: ${jiraClient.baseURL}`)

	await jiraClient.remoteLink.submit(jiraPayload);
};

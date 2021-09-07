import issueKeyParser from "jira-issue-key-parser";
import { Context } from "probot/lib/context";
import { JiraRemoteLinkData } from "../interfaces/jira";

function getLastUpdated({ status, started_at, completed_at }) {
	if (status === 'completed') {
		return completed_at;
	} else {
		return started_at;
	}
}

export default (context: Context): JiraRemoteLinkData => {
	const { code_scanning_alert } = context.payload;
	const issueKeys = issueKeyParser().parse(`${code_scanning_alert.instances.ref}`);

	if (!issueKeys) {
		return undefined;
	}

	return {
		//todo mapping
		product: 'GitHub - Code Scanning Alert',
		remoteLinks: [{
			schemaVersion: '1.0',
			id: code_scanning_alert.external_id,
			updateSequenceNumber: Date.now(),
			displayName: code_scanning_alert.name,
			url: code_scanning_alert.html_url,
			type: 'security',
			lastUpdated: getLastUpdated(code_scanning_alert)
		}],
	};
};

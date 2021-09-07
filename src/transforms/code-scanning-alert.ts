import issueKeyParser from "jira-issue-key-parser";
import { Context } from "probot/lib/context";
import {JiraRemoteLinkData, JiraRemoteLinkStatus} from "../interfaces/jira";

const getPullRequestTitle = (id: number): string => {
	return id.toString()
}

const getEntityTitle = (ref: string): string => {
	// ref can either be a branch reference or a PR reference
	const components = ref.split("/")
	switch (components[1]) {
		case "heads": // branch
			// The branch name may contain forward slashes! Rejoin them
			return components.slice(2).join("/");
		case "pull": // pull request
			const pullRequestId = components[2];
			return getPullRequestTitle(parseInt(pullRequestId));
		default:
			// log something here
			return "";
	}
}

const transformStatusToAppearance = (status: string): string => {
	switch (status) {
		case 'open':
			return 'removed'; // red
		case 'fixed':
			return 'success'; // green
		case 'dismissed':
			return 'moved'; // yellow
		default:
			return 'default';
	}
}

export default (context: Context): JiraRemoteLinkData => {
	const { action, alert, ref, repository} = context.payload;

	// Grab branch names or PR titles
	const entityTitles = [];
	if (action === 'closed_by_user' || action === 'reopened_by_user') {
		// These are manual operations done by users and are not associated to a specific Issue.
		// The webhook contains ALL instances of this alert, so we need to grab the ref from each instance.
		entityTitles.push(...alert.instances.map((instance) => getEntityTitle(instance.ref)));
	} else {
		// The action is associated with a single branch/PR
		entityTitles.push(getEntityTitle(ref));
	}

	const parser = issueKeyParser();
	// Flatten and get all issue keys
	const issueKeys = [].concat.apply([],
		entityTitles.map((entityTitle) => parser.parse(entityTitle))
	);

	if (issueKeys.length === 0) {
		return undefined;
	}

	const result =  {
		remoteLinks: [{
			schemaVersion: '1.0',
			id: repository.id.toString() + alert.number,
			updateSequenceNumber: Date.now(),
			displayName: alert.rule.description,
			description: alert.rule.full_description,
			url: alert.html_url,
			type: 'security',
			status: {
				appearance: transformStatusToAppearance(alert.most_recent_instance.state),
				label: alert.most_recent_instance.state
			},
			lastUpdated: alert.created_at,
			associations: [{
				associationType: 'issueKeys',
				values: issueKeys
			}]
		}]
	};

	console.log(result);
	return result;
};

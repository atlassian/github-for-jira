import issueKeyParser from "jira-issue-key-parser";
import {Context} from "probot/lib/context";
import {JiraRemoteLinkData, JiraRemoteLinkStatusAppearance} from "../interfaces/jira";
import logger from "../config/logger";

const MAX_STRING_LENGTH = 255;

const getPullRequestTitle = (repoName: string, prId: number, repoOwner: string, context: Context): Promise<string> => {
	return context.github.pulls.get({
		owner: repoOwner,
		repo: repoName,
		pull_number: prId
	}).then((response) => {
		if (response.status != 200) {
			throw response.data;
		} else {
			return response.data
		}
	}).then((pullRequest) => {
		return pullRequest.title;
	}).catch((err) => {
		return Promise.reject(`Received error when querying for Pull Request information: ${err}`)
	})
}

const getEntityTitle = (ref: string, repoName: string, repoOwner: string, context: Context): Promise<string> => {
	// ref can either be a branch reference or a PR reference
	const components = ref.split("/")
	switch (components[1]) {
		case "heads": // branch
			// The branch name may contain forward slashes! Rejoin them
			return Promise.resolve(components.slice(2).join("/"));
		case "pull": // pull request
			return getPullRequestTitle(repoName, parseInt(components[2]), repoOwner, context);
		default:
			return Promise.reject(`Could not interpret reference from code_scanning_alert: ${ref}`);
	}
}

// Status can be one of three things from the code_scanning_alert webhook: open, fixed, or dismissed
const transformStatusToAppearance = (status: string): JiraRemoteLinkStatusAppearance => {
	switch (status) {
		case "open":
			return "removed"; // red
		case "fixed":
			return "success"; // green
		case "dismissed":
			return "moved"; // yellow
		default:
			return "default";
	}
}

export default (context: Context): Promise<JiraRemoteLinkData> => {
	const {action, alert, ref, repository} = context.payload;

	// Grab branch names or PR titles
	const entityTitlesPromises: Promise<string>[] = [];
	if (action === "closed_by_user" || action === "reopened_by_user") {
		// These are manual operations done by users and are not associated to a specific Issue.
		// The webhook contains ALL instances of this alert, so we need to grab the ref from each instance.
		entityTitlesPromises.push(...alert.instances.map((instance) => getEntityTitle(instance.ref, repository.owner.login, repository.name, context)));
	} else {
		// The action is associated with a single branch/PR
		entityTitlesPromises.push(getEntityTitle(ref, repository.owner.login, repository.name, context));
	}

	return Promise.all(entityTitlesPromises).then(entityTitles => {
		const parser = issueKeyParser();
		const issueKeys = [].concat(...entityTitles.map((entityTitle) => parser.parse(entityTitle)));
		if (issueKeys.length === 0) {
			return undefined;
		}

		return {
			remoteLinks: [{
				schemaVersion: "1.0",
				id: `${repository.id.toString()}-${alert.number}`,
				updateSequenceNumber: Date.now(),
				displayName: `Alert #${alert.number}`,
				description: alert.rule.description.substring(0, MAX_STRING_LENGTH),
				url: alert.html_url,
				type: "security",
				status: {
					appearance: transformStatusToAppearance(alert.most_recent_instance.state),
					label: alert.most_recent_instance.state
				},
				lastUpdated: alert.created_at,
				associations: [{
					associationType: "issueKeys",
					values: issueKeys
				}]
			}]
		};
	}).catch((err) => {
		logger.warn(err);
		return undefined;
	})
};

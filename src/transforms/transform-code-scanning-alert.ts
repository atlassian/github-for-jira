import { jiraIssueKeyParser } from "utils/jira-utils";
import {
	JiraRemoteLinkBulkSubmitData,
	JiraRemoteLinkStatusAppearance,
	JiraVulnerabilityBulkSubmitData
} from "interfaces/jira";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { capitalize, truncate } from "lodash";
import { createInstallationClient } from "../util/get-github-client-config";
import { WebhookContext } from "../routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import {
	transformGitHubSeverityToJiraSeverity,
	transformGitHubStateToJiraStatus, transformRuleTagsToIdentifiers
} from "~/src/transforms/util/github-security-alerts";

const MAX_STRING_LENGTH = 255;

const getPullRequestTitle = async (repoName: string, prId: number, repoOwner: string, githubClient: GitHubInstallationClient, logger: Logger): Promise<string> => {

	const response = await githubClient.getPullRequest(repoOwner, repoName, prId);

	if (response.status !== 200) {
		logger.warn({ response }, "Received error when querying for Pull Request information.");
		return "";
	} else {
		return response.data.title;
	}
};

const getEntityTitle = async (ref: string, repoName: string, repoOwner: string, githubClient: GitHubInstallationClient, logger: Logger): Promise<string> => {
	// ref can either be a branch reference or a PR reference
	const components = ref.split("/");
	switch (components[1]) {
		case "heads": // branch
			// The branch name may contain forward slashes! Rejoin them
			return Promise.resolve(components.slice(2).join("/"));
		case "pull": // pull request
			return await getPullRequestTitle(repoName, parseInt(components[2]), repoOwner, githubClient, logger);
		default:
			logger.error(`Could not interpret reference from code_scanning_alert: ${ref}`);
			return "";
	}
};

// Status can be one of three things from the code_scanning_alert webhook: open, fixed, or dismissed
const transformStatusToAppearance = (status: string, context: WebhookContext): JiraRemoteLinkStatusAppearance => {
	switch (status) {
		case "open":
			return "removed"; // red
		case "fixed":
			return "success"; // green
		case "dismissed":
			return "moved"; // yellow
		default:
			context.log.info(`Received unknown status from code_scanning_alert webhook: ${status}`);
			return "default";
	}
};

export const transformCodeScanningAlert = async (context: WebhookContext, githubInstallationId: number, jiraHost: string): Promise<JiraRemoteLinkBulkSubmitData | null> => {
	const { action, alert, ref, repository } = context.payload;

	const metrics = {
		trigger: "webhook",
		subTrigger: "code_scanning_alert"
	};
	const gitHubInstallationClient = await createInstallationClient(githubInstallationId, jiraHost, metrics, context.log, context.gitHubAppConfig?.gitHubAppId);

	// Grab branch names or PR titles
	const entityTitles: string[] = [];
	if (action === "closed_by_user" || action === "reopened_by_user") {
		if (!alert.instances?.length) {
			return null;
		}
		// These are manual operations done by users and are not associated to a specific Issue.
		// The webhook contains ALL instances of this alert, so we need to grab the ref from each instance.
		entityTitles.push(...await Promise.all(alert.instances.map(
			(instance) => getEntityTitle(instance.ref, repository.name, repository.owner.login, gitHubInstallationClient, context.log))
		));
	} else {
		// The action is associated with a single branch/PR
		entityTitles.push(await getEntityTitle(ref, repository.name, repository.owner.login, gitHubInstallationClient, context.log));
	}

	const issueKeys = entityTitles.flatMap((entityTitle) => jiraIssueKeyParser(entityTitle) ?? []);
	if (!issueKeys.length) {
		return null;
	}

	return {
		remoteLinks: [{
			schemaVersion: "1.0",
			id: `${transformRepositoryId(repository.id, gitHubInstallationClient.baseUrl)}-${alert.number as number}`,
			updateSequenceNumber: Date.now(),
			displayName: `Alert #${alert.number as number}`,
			description: alert.rule.description.substring(0, MAX_STRING_LENGTH) || undefined,
			url: alert.html_url,
			type: "security",
			status: {
				appearance: transformStatusToAppearance(alert.most_recent_instance.state, context),
				label: alert.most_recent_instance.state
			},
			lastUpdated: alert.updated_at || alert.created_at,
			associations: [{
				associationType: "issueKeys",
				values: issueKeys
			}]
		}]
	};
};

export const transformCodeScanningAlertToJiraSecurity = async (context: WebhookContext, githubInstallationId: number, jiraHost: string): Promise<JiraVulnerabilityBulkSubmitData | null> => {
	const { alert, repository } = context.payload;

	if (!alert.most_recent_instance?.ref?.startsWith("refs/heads")) {
		context.log.info("Skipping code scanning alert detected on a pull request.");
		return null;
	}

	const metrics = {
		trigger: "webhook",
		subTrigger: "code_scanning_alert"
	};
	const gitHubInstallationClient = await createInstallationClient(githubInstallationId, jiraHost, metrics, context.log, context.gitHubAppConfig?.gitHubAppId);

	const handleUnmappedState = (state: string) => context.log.info(`Received unmapped state from code_scanning_alert webhook: ${state}`);
	const handleUnmappedSeverity = (severity: string | null) => context.log.info(`Received unmapped severity from code_scanning_alert webhook: ${severity ?? "Missing Severity"}`);

	const identifiers = transformRuleTagsToIdentifiers(alert.rule.tags);

	return {
		vulnerabilities: [{
			schemaVersion: "1.0",
			id: `c-${transformRepositoryId(repository.id, gitHubInstallationClient.baseUrl)}-${alert.number as number}`,
			updateSequenceNumber: Date.now(),
			containerId: transformRepositoryId(repository.id, gitHubInstallationClient.baseUrl),
			// display name cannot exceed 255 characters
			// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
			displayName: truncate(alert.rule.description || alert.rule.name || `Code scanning alert #${alert.number}`, { length: 254 }),
			description: getCodeScanningVulnDescription(alert, identifiers, context.log),
			url: alert.html_url,
			type: "sast",
			introducedDate: alert.created_at,
			lastUpdated: alert.dismissed_at || alert.fixed_at || alert.updated_at || alert.created_at,
			severity: {
				level: transformGitHubSeverityToJiraSeverity(alert.rule.security_severity_level, handleUnmappedSeverity)
			},
			...(identifiers ? { identifiers } : null),
			status: transformGitHubStateToJiraStatus(alert.state, handleUnmappedState),
			additionalInfo: {
				content: truncate(alert.tool.name, { length: 254 })
			}
		}]
	};
};


export const getCodeScanningVulnDescription = (
	alert,
	identifiers: { displayName: string, url: string; }[] | null,
	logger: Logger) => {
	try {
		const identifiersText = getIdentifiersText(identifiers);
		// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
		const description = `**Vulnerability:** ${alert.rule.description}\n\n**Severity:** ${capitalize(alert.rule?.security_severity_level)}\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**Status:** ${capitalize(alert.state)}\n\n**Weaknesses:** ${identifiersText}\n\nVisit the vulnerability’s [code scanning alert page](${alert.html_url}) in GitHub for impact, a recommendation, and a relevant example.`;
		// description cannot exceed 5000 characters
		return truncate(description, { length: 4999 });
	} catch (err: unknown) {
		logger.warn({ err }, "Failed to construct vulnerability description");
		return alert.rule?.description;
	}
};

const getIdentifiersText = (identifiers: { displayName: string, url: string; }[] | null): string => {
	if (identifiers) {
		const identifiersLink = identifiers.map(identifier => `[${identifier.displayName}](${identifier.url})`);
		return identifiersLink.join(", ");
	}
	return "";
};
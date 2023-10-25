import { envVars }  from "config/env";
import { getLogger } from "config/logger";
import { JiraIssue } from "interfaces/jira";
import { jiraIssueInSquareBracketsRegex } from "utils/jira-utils";
import { JiraClient } from "~/src/jira/client/jira-client";

const logger = getLogger("jira.util");

export const getJiraUtil = (jiraClient: JiraClient) => {
	const containsReferenceLink = (line: string) => {
		// reference text links should have 2 parts only
		if (line.split(" ").length === 2) {
			const hasSquareBrackets = line.charAt(0) === "[" && line.includes("]:");
			const hasUrl = line.includes("http://") || line.includes("https://");

			return hasSquareBrackets && hasUrl;
		}

		return false;
	};

	// Parse our existing issue text, pulling out any existing reference links.
	// if reference links exist, returns array of issue keys. For example, the following
	// reference links would return [ 'TEST-2019', 'TEST-2020' ]
	// [TEST-2019]: http://example.com/browse/TEST-2019
	// [TEST-2020]: https://example.com/browse/TEST-2020
	// if no issue keys exist, return []
	const checkForReferenceText = (text: string) => {
		const splitTextByNewLine = text.split("\n");

		return splitTextByNewLine
			.filter((line) => containsReferenceLink(line))
			.map((referenceLink) => referenceLink.slice(1, referenceLink.indexOf("]")));
	};

	const addJiraIssueLinks = (text: string, issues: JiraIssue[]): string => {
		const referenceRegex = jiraIssueInSquareBracketsRegex();
		const issueMap = issues.reduce((acc, issue) => ({
			...acc,
			[issue.key]: issue
		}), {});

		const links: string[] = [];
		const keys = checkForReferenceText(text);

		// Parse the text up to a maximum amount of characters.
		while (referenceRegex.lastIndex < 1000) {
			const match = referenceRegex.exec(text);

			if (!match) {
				break;
			}

			const [, , key] = match;
			// If we already have a reference link, or the issue is not valid, skip it.
			if (keys.includes(key) || !issueMap[key]) {
				continue;
			}

			const issueTrackingParam = envVars.JIRA_LINK_TRACKING_ID ? `?atlOrigin=${envVars.JIRA_LINK_TRACKING_ID}` : "";

			const link = `${jiraClient.baseURL}/browse/${key}${issueTrackingParam}`;
			const reference = `[${key}]: ${link}`;

			if (text.includes(reference)) {
				continue;
			}

			links.push(reference);
		}

		return links.length ? [text, links.join("\n")].join("\n\n") : text;
	};

	const unfurl = async (text: string): Promise<string | undefined> => {
		try {
			const issues = jiraClient.issues.parse(text);
			if (!issues) return undefined;

			const validIssues = await jiraClient.issues.getAll(issues);
			if (!validIssues.length) return undefined;

			const linkifiedBody = addJiraIssueLinks(text, validIssues);
			if (linkifiedBody === text) return undefined;

			return linkifiedBody;
		} catch (err: unknown) {
			logger.warn({ err, issueText: text }, "Error getting all JIRA issues");
			return undefined;
		}
	};

	type Command = {
		kind: string;
		name: string;
		text: string;
		time: number;
		issueKeys: string[]
	};
	const runJiraCommands = async (commands: Command[]) => {
		return Promise.all(commands.map(command => {
			if (command.kind === "comment") {
				return Promise.all(command.issueKeys.map(issueKey => jiraClient.issues.comments.addForIssue(issueKey, {
					body: command.text
				})));
			}

			if (command.kind === "worklog") {
				return Promise.all(command.issueKeys.map(issueKey => jiraClient.issues.worklogs.addForIssue(issueKey, {
					timeSpentSeconds: command.time,
					comment: command.text
				})));
			}

			if (command.kind === "transition") {
				return Promise.all(command.issueKeys.map(async issueKey => {
					const transitions = (await jiraClient.issues.transitions.getForIssue(issueKey))
						.data
						.transitions
						.map((transition: {id: string, name: string}) => ({
							id: transition.id,
							name: transition.name.replace(" ", "-").toLowerCase()
						}))
						.filter((transition: {id: string, name: string}) => transition.name.startsWith(command.name));

					// We only want to run a transition if we match only one. If we don't match a transition
					// or if we match two transitions, we should resolve rather than transitioning.
					if (transitions.length !== 1) {
						return Promise.resolve();
					}

					if (command.text) {
						await jiraClient.issues.comments.addForIssue(issueKey, {
							body: command.text
						});
					}

					return jiraClient.issues.transitions.updateForIssue(issueKey, transitions[0].id);
				}));
			}
			return Promise.resolve();
		}));
	};

	return {
		addJiraIssueLinks,
		runJiraCommands,
		unfurl
	};
};

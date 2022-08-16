import Logger from "bunyan";
import { Subscription } from "models/subscription";
import { getJiraClient } from "../jira/client/jira-client";
import { getJiraAuthor, jiraIssueKeyParser, limitCommitMessage } from "utils/jira-utils";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { JiraCommit } from "interfaces/jira";
import { isBlocked } from "config/feature-flags";
import { sqsQueues } from "../sqs/queues";
import { PushQueueMessagePayload, GitHubAppConfig } from "~/src/sqs/sqs.types";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { isEmpty } from "lodash";
import { GitHubPushData } from "../interfaces/github";

// TODO: define better types for this file
const mapFile = (
	githubFile,
	repoName: string,
	repoOwner: string | null,
	commitHash: string
) => {
	// changeType enum: [ "ADDED", "COPIED", "DELETED", "MODIFIED", "MOVED", "UNKNOWN" ]
	// on github when a file is renamed we get two "files": one added, one removed
	const mapStatus = {
		added: "ADDED",
		removed: "DELETED",
		modified: "MODIFIED"
	};

	const fallbackUrl = `https://github.com/${repoOwner}/${repoName}/blob/${commitHash}/${githubFile.filename}`;

	return {
		path: githubFile.filename,
		changeType: mapStatus[githubFile.status] || "UNKNOWN",
		linesAdded: githubFile.additions,
		linesRemoved: githubFile.deletions,
		url: githubFile.blob_url || fallbackUrl
	};
};

export const createJobData = (payload: GitHubPushData, jiraHost: string, gitHubAppConfig?: GitHubAppConfig): PushQueueMessagePayload => {
	// Store only necessary repository data in the queue
	const { id, name, full_name, html_url, owner } = payload.repository;

	const repository = {
		id,
		name,
		full_name,
		html_url,
		owner
	};

	const shas: { id: string, issueKeys: string[] }[] = [];
	for (const commit of payload.commits) {
		const issueKeys = jiraIssueKeyParser(commit.message);
		if (!isEmpty(issueKeys)) {
			// Only store the sha and issue keys. All other data will be requested from GitHub as part of the job
			// Creates an array of shas for the job processor to work on
			shas.push({ id: commit.id, issueKeys });
		}
	}

	return {
		repository,
		shas,
		jiraHost,
		installationId: payload.installation.id,
		webhookId: payload.webhookId || "none",
		webhookReceived: payload.webhookReceived || undefined,
		gitHubAppConfig
	};
};

export const enqueuePush = async (payload: GitHubPushData, jiraHost: string, gitHubAppConfig?: GitHubAppConfig) =>
	await sqsQueues.push.sendMessage(createJobData(payload, jiraHost, gitHubAppConfig));

export const processPush = async (gitHub: GitHubInstallationClient, payload: PushQueueMessagePayload, rootLogger: Logger) => {
	const {
		repository,
		repository: { owner, name: repo },
		shas,
		installationId,
		jiraHost
	} = payload;

	if (await isBlocked(installationId, rootLogger)) {
		rootLogger.warn({ installationId }, "blocking processing of push message because installationId is on the blocklist");
		return;
	}

	const webhookId = payload.webhookId || "none";
	const webhookReceived = payload.webhookReceived || undefined;

	const log = rootLogger.child({
		webhookId: webhookId,
		repoName: repo,
		orgName: owner.name,
		installationId,
		webhookReceived,
		jiraHost
	});

	log.info("Processing push");

	try {
		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			installationId,
			payload.gitHubAppConfig?.gitHubAppId
		);

		if (!subscription) {
			log.info("No subscription was found, stop processing the push");
			return;
		}

		const gitHubInstallationId = subscription.gitHubInstallationId;

		const jiraClient = await getJiraClient(
			subscription.jiraHost,
			gitHubInstallationId,
			log
		);

		const commits: JiraCommit[] = await Promise.all(
			shas.map(async (sha): Promise<JiraCommit> => {
				log.info("Calling GitHub to fetch commit info " + sha.id);
				try {
					const {
						data: {
							files,
							author,
							parents,
							sha: commitSha,
							html_url,
							commit: {
								author: githubCommitAuthor,
								message
							}
						}
					} = await gitHub.getCommit(owner.login, repo, sha.id);

					// Jira only accepts a max of 10 files for each commit, so don't send all of them
					const filesToSend = files.slice(0, 10);

					// merge commits will have 2 or more parents, depending how many are in the sequence
					const isMergeCommit = parents?.length > 1;

					log.info("GitHub call succeeded");
					return {
						hash: commitSha,
						message: limitCommitMessage(message),
						author: getJiraAuthor(author, githubCommitAuthor),
						authorTimestamp: githubCommitAuthor.date,
						displayId: commitSha.substring(0, 6),
						fileCount: files.length, // Send the total count for all files
						files: filesToSend.map((file) => mapFile(file, repo, owner.name, sha.id)),
						id: commitSha,
						issueKeys: sha.issueKeys,
						url: html_url,
						updateSequenceId: Date.now(),
						flags: isMergeCommit ? ["MERGE_COMMIT"] : undefined
					};
				} catch (err) {
					log.warn({ err }, "Failed to fetch data from GitHub");
					throw err;
				}
			})
		);

		// Jira accepts up to 400 commits per request
		// break the array up into chunks of 400
		const chunks: JiraCommit[][] = [];

		while (commits.length) {
			chunks.push(commits.splice(0, 400));
		}

		for (const chunk of chunks) {
			const jiraPayload = {
				name: repository.name,
				url: repository.html_url,
				id: repository.id,
				commits: chunk,
				updateSequenceId: Date.now()
			};

			log.info("Sending data to Jira");
			try {
				const jiraResponse = await jiraClient.devinfo.repository.update(jiraPayload);

				webhookReceived && emitWebhookProcessedMetrics(
					webhookReceived,
					"push",
					log,
					jiraResponse?.status
				);
			} catch (err) {
				log.warn({ err }, "Failed to send data to Jira");
				throw err;
			}
		}
		log.info("Push has succeeded");
	} catch (err) {
		log.warn({ err }, "Push has failed");
	}
};

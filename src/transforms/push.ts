import Logger from "bunyan";
import { Subscription } from "models/subscription";
import { getJiraClient } from "../jira/client/jira-client";
import { getJiraAuthor, jiraIssueKeyParser, limitCommitMessage } from "utils/jira-utils";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { JiraCommit, JiraCommitFile, JiraCommitFileChangeTypeEnum } from "interfaces/jira";
import { isBlocked, shouldSendAll } from "config/feature-flags";
import { sqsQueues } from "../sqs/queues";
import { GitHubAppConfig, PushQueueMessagePayload } from "~/src/sqs/sqs.types";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { compact, isEmpty } from "lodash";
import { GithubCommitFile, GitHubPushData } from "interfaces/github";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";

const MAX_COMMIT_HISTORY = 10;
// TODO: define better types for this file
const mapFile = (
	githubFile: GithubCommitFile,
	repoName: string,
	commitHash: string,
	repoOwner?: string
): JiraCommitFile | undefined => {
	// changeType enum: [ "ADDED", "COPIED", "DELETED", "MODIFIED", "MOVED", "UNKNOWN" ]
	// on github when a file is renamed we get two "files": one added, one removed
	const mapStatus = {
		added: JiraCommitFileChangeTypeEnum.ADDED,
		removed: JiraCommitFileChangeTypeEnum.DELETED,
		modified: JiraCommitFileChangeTypeEnum.MODIFIED,
		renamed: JiraCommitFileChangeTypeEnum.MOVED,
		copied: JiraCommitFileChangeTypeEnum.COPIED,
		changed: JiraCommitFileChangeTypeEnum.MODIFIED,
		unchanged: JiraCommitFileChangeTypeEnum.UNKNOWN
	};

	const fallbackUrl = `https://github.com/${repoOwner ?? "undefined"}/${repoName}/blob/${commitHash}/${githubFile.filename}`;

	if (isEmpty(githubFile.filename)) {
		return undefined;
	}

	return {
		path: githubFile.filename.slice(0, 1024), // max length 1024
		changeType: mapStatus[githubFile.status] || JiraCommitFileChangeTypeEnum.UNKNOWN,
		linesAdded: githubFile.additions,
		linesRemoved: githubFile.deletions,
		url: githubFile.blob_url || fallbackUrl
	};
};

export const createJobData = async (payload: GitHubPushData, jiraHost: string, logger: Logger, gitHubAppConfig?: GitHubAppConfig): Promise<PushQueueMessagePayload> => {
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
	const alwaysSend = await shouldSendAll("commits", jiraHost, logger);
	for (const commit of payload.commits) {
		const issueKeys = jiraIssueKeyParser(commit.message);
		if (!isEmpty(issueKeys) || alwaysSend) {
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

export const enqueuePush = async (payload: GitHubPushData, jiraHost: string, logger: Logger, gitHubAppConfig?: GitHubAppConfig) =>
	await sqsQueues.push.sendMessage(await createJobData(payload, jiraHost, logger, gitHubAppConfig), 0, logger);

export const processPush = async (github: GitHubInstallationClient, payload: PushQueueMessagePayload, rootLogger: Logger) => {
	const {
		repository,
		repository: { owner, name: repo },
		shas,
		installationId: gitHubInstallationId,
		jiraHost
	} = payload;

	if (await isBlocked(jiraHost, gitHubInstallationId, rootLogger)) {
		rootLogger.warn({ gitHubInstallationId }, "blocking processing of push message because installationId is on the blocklist");
		return;
	}

	const webhookId = payload.webhookId || "none";
	const webhookReceived = payload.webhookReceived || undefined;

	const log = rootLogger.child({
		webhookId: webhookId,
		repoName: repo,
		orgName: owner.name,
		gitHubInstallationId,
		webhookReceived,
		jiraHost
	});

	log.info({ shas, shasCount: shas?.length }, "Processing push");

	const gitHubAppId = payload.gitHubAppConfig?.gitHubAppId;

	try {
		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			gitHubInstallationId,
			payload.gitHubAppConfig?.gitHubAppId
		);

		if (!subscription) {
			log.info("No subscription was found, stop processing the push");
			return;
		}

		const jiraClient = await getJiraClient(
			subscription.jiraHost,
			gitHubInstallationId,
			gitHubAppId,
			log
		);
		if (!jiraClient) {
			log.info("Halting further execution for push as JiraClient is empty for this installation");
			return;
		}

		const recentShas = shas.slice(0, MAX_COMMIT_HISTORY);
		const commitPromises: Promise<JiraCommit | null>[] = recentShas.map(async (sha): Promise<JiraCommit | null> => {
			log.info("Calling GitHub to fetch commit info " + sha.id);
			try {
				const commitResponse = await github.getCommit(owner.login, repo, sha.id);
				const {
					files,
					author: author = {},
					parents,
					sha: commitSha,
					html_url
				} = commitResponse.data;

				if (!commitSha) {
					return null;
				}

				const githubCommitAuthor = commitResponse.data.commit?.author;
				const message = commitResponse.data.commit?.message;

				// Jira only accepts a max of 10 files for each commit, so don't send all of them
				const filesToSend = Array.isArray(files) ? files.slice(0, 10) as GithubCommitFile[] : [];

				// merge commits will have 2 or more parents, depending on how many are in the sequence
				const isMergeCommit = parents?.length > 1;

				log.info("GitHub call succeeded");
				return {
					hash: commitSha,
					message: limitCommitMessage(message),
					author: getJiraAuthor(author, githubCommitAuthor),
					authorTimestamp: githubCommitAuthor?.date,
					displayId: commitSha.substring(0, 6),
					fileCount: files.length, // Send the total count for all files
					files: compact(filesToSend.map((file) => mapFile(file, repo, sha.id, owner.name))),
					id: commitSha,
					issueKeys: sha.issueKeys,
					url: html_url,
					updateSequenceId: Date.now(),
					flags: isMergeCommit ? ["MERGE_COMMIT"] : undefined
				};
			} catch (err: unknown) {
				log.warn({ err }, "Failed to fetch data from GitHub");
				throw err;
			}
		});

		const commitResults: (JiraCommit | null)[] = await Promise.all(commitPromises);

		const commits: JiraCommit[] = commitResults.filter(commit => commit !== null) as JiraCommit[];

		// Jira accepts up to 400 commits per request
		// break the array up into chunks of 400
		const chunks: JiraCommit[][] = [];
		while (commits?.length) {
			chunks.push(commits.splice(0, 400));
		}

		for (const chunk of chunks) {
			const jiraPayload = {
				... transformRepositoryDevInfoBulk(repository, payload.gitHubAppConfig?.gitHubBaseUrl),
				commits: chunk
			};

			log.info("Sending data to Jira");
			try {
				const jiraResponse = await jiraClient.devinfo.repository.update(
					jiraPayload,
					{
						preventTransitions: false,
						operationType: "NORMAL",
						auditLogsource: "WEBHOOK",
						entityAction: "COMMIT_PUSH",
						subscriptionId: subscription.id
					}
				);
				webhookReceived &&
					emitWebhookProcessedMetrics(
						webhookReceived,
						"push",
						jiraHost,
						log,
						jiraResponse?.status,
						gitHubAppId
					);
			} catch (err: unknown) {
				log.warn({ err }, "Failed to send data to Jira");
				throw err;
			}
		}
		log.info("Push has succeeded");
	} catch (err: unknown) {
		log.warn({ err }, "Push has failed");
		throw err;
	}
};

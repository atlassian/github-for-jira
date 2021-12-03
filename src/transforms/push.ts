import {Subscription} from "../models";
import getJiraClient from "../jira/client";
import issueKeyParser from "jira-issue-key-parser";
import enhanceOctokit from "../config/enhance-octokit";
import {Application, GitHubAPI} from "probot";
import {Job, JobOptions} from "bull";
import {getJiraAuthor} from "../util/jira";
import {emitWebhookProcessedMetrics} from "../util/webhooks";
import {JiraCommit} from "../interfaces/jira";
import _ from "lodash";
import {queues} from "../worker/queues";
import {LoggerWithTarget} from "probot/lib/wrap-logger";
import {booleanFlag, BooleanFlags, isBlocked} from "../config/feature-flags";
import sqsQueues from "../sqs/queues";
import {PushQueueMessagePayload} from "../sqs/push";
import GitHubClient from "../github/client/github-client";

// TODO: define better types for this file

export const PUSH_LOGGER_NAME = "transforms.push";

const mapFile = (
	githubFile,
	repoName: string,
	repoOwner: string,
	commitHash: string
) => {
	// changeType enum: [ "ADDED", "COPIED", "DELETED", "MODIFIED", "MOVED", "UNKNOWN" ]
	// on github when a file is renamed we get two "files": one added, one removed
	const mapStatus = {
		added: "ADDED",
		removed: "DELETED",
		modified: "MODIFIED",
	};

	const fallbackUrl = `https://github.com/${repoOwner}/${repoName}/blob/${commitHash}/${githubFile.filename}`;

	return {
		path: githubFile.filename,
		changeType: mapStatus[githubFile.status] || "UNKNOWN",
		linesAdded: githubFile.additions,
		linesRemoved: githubFile.deletions,
		url: githubFile.blob_url || fallbackUrl,
	};
};

export const createJobData = (payload, jiraHost: string) : PushQueueMessagePayload => {
	// Store only necessary repository data in the queue
	const { id, name, full_name, html_url, owner } = payload.repository;

	const repository = {
		id,
		name,
		full_name,
		html_url,
		owner,
	};

	const shas: { id: string, issueKeys: string[] }[] = [];
	for (const commit of payload.commits) {
		const issueKeys = issueKeyParser().parse(commit.message) || [];

		if (_.isEmpty(issueKeys)) {
			// Don't add this commit to the queue since it doesn't have issue keys
			continue;
		}

		// Only store the sha and issue keys. All other data will be requested from GitHub as part of the job
		// Creates an array of shas for the job processor to work on
		shas.push({ id: commit.id, issueKeys });
	}

	return {
		repository,
		shas,
		jiraHost,
		installationId: payload.installation.id,
		webhookId: payload.webhookId || "none",
		webhookReceived: payload.webhookReceived || undefined,
	};
}

export async function enqueuePush(
	payload: unknown,
	jiraHost: string,
	options?: JobOptions
) {
	if(await booleanFlag(BooleanFlags.SEND_PUSH_TO_SQS, false, jiraHost)) {
		return sqsQueues.push.sendMessage(createJobData(payload, jiraHost));
	} else {
		return queues.push.add(createJobData(payload, jiraHost), options);
	}
}

export function processPushJob(app: Application) {
	return async (job: Job, logger: LoggerWithTarget): Promise<void> => {
		let githubOld;
		try {
			githubOld = await app.auth(job.data.installationId);
		} catch (err) {
			logger.error({ err, job }, "Could not authenticate");
			return;
		}
		enhanceOctokit(githubOld);

		const github = new GitHubClient(job.data.installationId, logger);
		await processPush(githubOld, github, job.data, logger);
	};
}

export const processPush = async (githubOld: GitHubAPI, github: GitHubClient, payload, rootLogger: LoggerWithTarget) => {
	const {
		repository,
		repository: { owner, name: repo },
		shas,
		installationId,
		jiraHost,
	} = payload;

	if (await isBlocked(installationId, rootLogger)) {
		rootLogger.warn({ payload, installationId }, "blocking processing of push message because installationId is on the blocklist");
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
	});

	log.info("Processing push");

	try {
		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			installationId
		);

		if (!subscription) {
			log.info("No subscription was found, stop processing the push");
			return;
		}

		const jiraClient = await getJiraClient(
			subscription.jiraHost,
			installationId,
			log
		);

		const commits: JiraCommit[] = await Promise.all(
			shas.map(async (sha): Promise<JiraCommit> => {
				log.info("Calling GitHub to fetch commit info " + sha.id);
				const useNewGithubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_PUSH, false, subscription.jiraHost);
				try {
					const {
						data,
						data: {commit: githubCommit},
					} = useNewGithubClient
						? await github.getCommit(owner.login, repo, sha.id)
						: await githubOld.repos.getCommit({
							owner: owner.login,
							repo,
							ref: sha.id,
						});

					const {files, author, parents, sha: commitSha, html_url} = data;

					const {author: githubCommitAuthor, message} = githubCommit;

					// Jira only accepts a max of 10 files for each commit, so don't send all of them
					const filesToSend = files.slice(0, 10);

					// merge commits will have 2 or more parents, depending how many are in the sequence
					const isMergeCommit = parents?.length > 1;

					console.info("GitHub call succeeded");
					return {
						hash: commitSha,
						message,
						author: getJiraAuthor(author, githubCommitAuthor),
						authorTimestamp: githubCommitAuthor.date,
						displayId: commitSha.substring(0, 6),
						fileCount: files.length, // Send the total count for all files
						files: filesToSend.map((file) =>
							mapFile(file, repo, owner.name, sha.id)
						),
						id: commitSha,
						issueKeys: sha.issueKeys,
						url: html_url,
						updateSequenceId: Date.now(),
						flags: isMergeCommit ? ["MERGE_COMMIT"] : undefined,
					}
				} catch (err) {
					console.warn({ err },"Failed to fetch data from GitHub");
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
				updateSequenceId: Date.now(),
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

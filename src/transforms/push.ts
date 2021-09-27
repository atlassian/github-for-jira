import { Subscription } from "../models";
import getJiraClient from "../jira/client";
import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../jira/util/isEmpty";
import { queues } from "../worker/main";
import enhanceOctokit from "../config/enhance-octokit";
import { Application, GitHubAPI } from "probot";
import { getLogger } from "../config/logger";
import { Job, JobOptions } from "bull";
import { getJiraAuthor } from "../util/jira";
import { calculateProcessingTimeInSeconds } from "../util/webhooks";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

// TODO: define better types for this file

const logger = getLogger("transforms.push");

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

export function createJobData(payload, jiraHost: string) {
	// Store only necessary repository data in the queue
	const { id, name, full_name, html_url, owner } = payload.repository;

	const repository = {
		id,
		name,
		full_name,
		html_url,
		owner,
	};

	const shas = [];
	for (const commit of payload.commits) {
		const issueKeys = issueKeyParser().parse(commit.message);

		if (isEmpty(issueKeys)) {
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
	return queues.push.add(createJobData(payload, jiraHost), options);
}

export function processPushJob(app: Application) {
	return async (job: Job): Promise<void> => {
		let github;
		try {
			github = await app.auth(job.data.installationId);
		} catch (err) {
			logger.error({ err, job }, "Could not authenticate");
			return;
		}
		enhanceOctokit(github);
		await processPush(github, job.data);
	};
}

export const processPush = async (github: GitHubAPI, payload) => {
	let log = logger;
	try {
		const {
			repository,
			repository: { owner, name: repo },
			shas,
			installationId,
			jiraHost,
		} = payload;

		const webhookId = payload.webhookId || "none";
		const webhookReceived = payload.webhookReceived || undefined;

		log = logger.child({
			webhookId: webhookId,
			repoName: repo,
			orgName: owner.name,
			webhookReceived,
		});

		log.info({ installationId }, "Processing push");

		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			installationId
		);

		if (!subscription) return;

		const jiraClient = await getJiraClient(
			subscription.jiraHost,
			installationId,
			log
		);

		const commits = await Promise.all(
			shas.map(async (sha) => {
				const {
					data,
					data: { commit: githubCommit },
				} = await github.repos.getCommit({
					owner: owner.login,
					repo,
					ref: sha.id,
				});

				const { files, author, parents, sha: commitSha, html_url } = data;

				const { author: githubCommitAuthor, message } = githubCommit;

				// Jira only accepts a max of 10 files for each commit, so don't send all of them
				const filesToSend = files.slice(0, 10);

				// merge commits will have 2 or more parents, depending how many are in the sequence
				const isMergeCommit = parents?.length > 1;

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
				};
			})
		);

		// Jira accepts up to 400 commits per request
		// break the array up into chunks of 400
		const chunks = [];
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

			const jiraResponse = await jiraClient.devinfo.repository.update(
				jiraPayload
			);
			const webhookName = payload.name || "none";

			if (
				(await booleanFlag(BooleanFlags.WEBHOOK_RECEIVED_METRICS, false)) &&
				webhookReceived
			) {
				calculateProcessingTimeInSeconds(
					webhookReceived,
					webhookName,
					log,
					jiraResponse?.status
				);
			}
		}
	} catch (error) {
		log.error(error, "Failed to process push");
		throw error;
	}
};

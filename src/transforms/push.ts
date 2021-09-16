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
import { getGithubCommits, GithubCommitFile } from "../services/github/commit";

// TODO: define better types for this file

const logger = getLogger("transforms.push");

const mapFile = (file: GithubCommitFile) => {
	// changeType enum: [ "ADDED", "COPIED", "DELETED", "MODIFIED", "MOVED", "UNKNOWN" ]
	// on github when a file is renamed we get two "files": one added, one removed
	/*const mapStatus = {
		added: "ADDED",
		removed: "DELETED",
		modified: "MODIFIED"
	};*/

	return {
		path: file.path,
		changeType: /*mapStatus[file.status] ||*/ "UNKNOWN",
		// linesAdded: file.additions,
		// linesRemoved: file.deletions,
		url: `https://github.com${file.object.commitResourcePath}`
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
		owner
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
		webhookId: payload.webhookId || "none"
	};
}

export async function enqueuePush(payload: unknown, jiraHost: string, options?: JobOptions) {
	return queues.push.add(createJobData(payload, jiraHost), options);
}

export function processPushJob(app: Application) {
	return async (job: Job): Promise<void> => {
		try {
			const github = await app.auth(job.data.installationId);
			enhanceOctokit(github);
			await processPush(github, job.data);
		} catch (err) {
			logger.error({ err, job }, "Could not authenticate");
		}
	};
}

export const processPush = async (github: GitHubAPI, payload) => {
	let log = logger;
	try {
		const {
			repository,
			repository: { owner, name: repoName },
			shas,
			installationId,
			jiraHost
		} = payload;

		const webhookId = payload.webhookId || "none";
		log = logger.child({
			webhookId: webhookId,
			repoName: repoName,
			orgName: owner.name
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

		const commits = (await getGithubCommits(github, {
			commitRefs: shas.map(s => s.id),
			owner: owner.login,
			repoName
		})).map(commit => {
			const {/* files,*/
				oid,
				abbreviatedOid,
				author,
				authoredDate,
				parents: { totalCount: parentCount },
				url,
				message,
				changedFiles,
				tree: { entries: files }
			} = commit;

			// Jira only accepts a max of 10 files for each commit, so don't send all of them
			// const filesToSend = files.slice(0, 10);

			// merge commits will have 2 or more parents, depending how many are in the sequence
			const isMergeCommit = parentCount !== 0;

			return {
				hash: oid,
				message,
				author: getJiraAuthor(author),
				authorTimestamp: authoredDate,
				displayId: abbreviatedOid,
				fileCount: changedFiles, // Send the total count for all files
				files: files.map(mapFile),
				id: oid,
				issueKeys: shas.find(s => s.id === commit.oid).issueKeys,
				url,
				updateSequenceId: Date.now(),
				flags: isMergeCommit ? ["MERGE_COMMIT"] : undefined
			};
		});

		/*const commits = await Promise.all(
			shas.map(async (sha) => {
				const {
					data,
					data: { commit: githubCommit }
				} = await github.repos.getCommit({
					owner: owner.login,
					repo: repoName,
					ref: sha.id
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
					files: filesToSend.map(file => mapFile(file, repoName, owner.name, sha.id)),
					id: commitSha,
					issueKeys: sha.issueKeys,
					url: html_url,
					updateSequenceId: Date.now(),
					flags: isMergeCommit ? ["MERGE_COMMIT"] : undefined
				};
			})
		);*/

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
				updateSequenceId: Date.now()
			};

			await jiraClient.devinfo.repository.update(jiraPayload);
		}

	} catch (error) {
		log.error(error, "Failed to process push");
	}
};

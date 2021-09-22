import { Subscription } from "../models";
import getJiraClient from "../jira/client";
import issueKeyParser from "jira-issue-key-parser";
import { queues } from "../worker/main";
import enhanceOctokit from "../config/enhance-octokit";
import { Application, GitHubAPI } from "probot";
import { getLogger } from "../config/logger";
import { Job, JobOptions } from "bull";
import { getJiraAuthor } from "../util/jira";
import { getSpecificGithubCommits, GithubCommit, GithubCommitFile } from "../services/github/commit";
import { JiraCommit, JiraCommitFile } from "../interfaces/jira";
import _ from "lodash";

// TODO: define better types for this file

const logger = getLogger("transforms.push");

const mapFile = (file: GithubCommitFile): JiraCommitFile => {
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
		webhookId: payload.webhookId || "none"
	};
}

export async function enqueuePush(payload: unknown, jiraHost: string, options?: JobOptions) {
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

		const commits: JiraCommit[] = (await getSpecificGithubCommits(github, {
			commitRefs: shas.map(s => s.id),
			owner: owner.login,
			repoName
		})).map((commit: GithubCommit): JiraCommit => {
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
				authorTimestamp: Date.parse(authoredDate),
				displayId: abbreviatedOid,
				fileCount: changedFiles, // Send the total count for all files
				files: files.map(mapFile),
				id: oid,
				issueKeys: shas.find(s => s.id === commit.oid).issueKeys,
				url,
				updateSequenceId: Date.now(),
				timestamp: Date.now(),
				flags: isMergeCommit ? ["MERGE_COMMIT"] : undefined
			};
		});

		// Jira accepts up to 400 commits per request
		// break the array up into chunks of 400
		const chunks:JiraCommit[][] = [];
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
		throw error;
	}
};

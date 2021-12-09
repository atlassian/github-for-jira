import { createJobData, enqueuePush, processPush } from "../transforms/push";
import issueKeyParser from "jira-issue-key-parser";
import { Context } from "probot/lib/context";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { getCurrentTime } from '../util/webhooks';
import _ from "lodash";
import GitHubClient from "./client/github-client";

export default async (context: Context, jiraClient): Promise<void> => {
	const webhookReceived = getCurrentTime();

	// Copy the shape of the context object for processing
	// but filter out any commits that don't have issue keys
	// so we don't have to process them.
	const payload = {
		webhookId: context.id,
		webhookReceived,
		repository: context.payload?.repository,
		// TODO: use reduce instead
		commits: context.payload?.commits?.map((commit) => {
			const issueKeys = issueKeyParser().parse(commit.message);

			if (!_.isEmpty(issueKeys)) {
				return commit;
			}
		})
			.filter((commit) => !!commit),
		installation: context.payload?.installation
	};

	if (!payload.commits?.length) {
		context.log(
			{ noop: "no_commits" },
			"Halting further execution for push since no commits were found for the payload"
		);
		return;
	}

	// If there's less than 20 commits (the number of commits the github API returns per call), just process it immediately
	if(payload.commits?.length < 20 && await booleanFlag(BooleanFlags.PROCESS_PUSHES_IMMEDIATELY, true, jiraClient.baseURL)) {
		context.log.info("Processing push straight away");
		// TODO: this path is not used, opportunistically adding this line to make TypeScript happy without much testing
		const githubNew = new GitHubClient(payload.installation?.id, context.log);
		await processPush(context.github, githubNew, createJobData(payload, jiraClient.baseURL), context.log);
		return;
	}

	// Since a push event can have any number of commits
	// and we have to process each one individually to get the
	// data we need for Jira, send this to a background job
	// so we can close the http connection as soon as the jobs
	// are in the queue.  Set as priority 1 to get this done before any other sync.
	const prioritize = await booleanFlag(BooleanFlags.PRIORITIZE_PUSHES, true);

	if (prioritize) {
		context.log("Enqueueing push event (prioritized)");
		await enqueuePush(payload, jiraClient.baseURL, { priority: 1 });
	} else {
		context.log("Enqueueing push event (not prioritized)");
		await enqueuePush(payload, jiraClient.baseURL);
	}
};

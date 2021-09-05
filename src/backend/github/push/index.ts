import { enqueuePush } from "../../transforms/push";
import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../../../common/isEmpty";
import { Context } from "probot/lib/context";

export default async (context: Context, jiraClient): Promise<void> => {
	// Copy the shape of the context object for processing
	// but filter out any commits that don't have issue keys
	// so we don't have to process them.
	const payload = {
		webhookId: context.id,
		repository: context.payload?.repository,
		commits: context.payload?.commits?.map((commit) => {
			const issueKeys = issueKeyParser().parse(commit.message);

			if (!isEmpty(issueKeys)) {
				return commit;
			}
		})
			.filter((commit) => !!commit),
		installation: context.payload?.installation
	};

	if (payload.commits?.length === 0) {
		context.log(
			{ noop: "no_commits" },
			"Halting further execution for push since no commits were found for the payload"
		);
		return;
	}

	context.log("Enqueueing push event");
	// Since a push event can have any number of commits
	// and we have to process each one individually to get the
	// data we need for Jira, send this to a background job
	// so we can close the http connection as soon as the jobs
	// are in the queue.  Set as priority 1 to get this done before any other sync.
	await enqueuePush(payload, jiraClient.baseURL, { priority: 1 });
};

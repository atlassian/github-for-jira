import { GitHubAPI } from "probot";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import GitHubClient from "../../github/client/github-client";

interface CompareCommitsPayload {
	owner: string;
	repo: string;
	base: string;
	head: string;
}

// Used to compare commits for builds and deployments so we can
// obtain all issue keys referenced in commit messages.
export const getAllCommitMessagesBetweenReferences = async (
	payload: CompareCommitsPayload,
	github: GitHubAPI | GitHubClient,
	logger: LoggerWithTarget
): Promise<string | undefined | void> => {
	try {
		const commitsDiff = github instanceof GitHubClient ? await github.compareReferences(payload.owner, payload.repo, payload.base, payload.head) : await github.repos.compareCommits(payload);
		const allCommitMessagesFromPullRequest = commitsDiff.data?.commits
			?.map((c) => c.commit.message)
			.join(" ");

		return allCommitMessagesFromPullRequest;
	} catch (err) {
		logger?.error(
			{ err, repo: payload.repo },
			"Failed to compare commits on repo."
		);
	}
};

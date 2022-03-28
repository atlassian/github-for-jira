import { GitHubAPI } from "probot";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { GitHubAppClient } from "../../github/client/github-app-client";

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
	github: GitHubAPI | GitHubAppClient,
	logger: LoggerWithTarget
): Promise<string> => {
	let messages;
	try {
		const commitsDiff = github instanceof GitHubAppClient ? await github.compareReferences(payload.owner, payload.repo, payload.base, payload.head) : await github.repos.compareCommits(payload);
		messages = commitsDiff.data?.commits
			?.map((c) => c.commit.message)
			.join(" ");
	} catch (err) {
		logger?.error(
			{ err, repo: payload.repo },
			"Failed to compare commits on repo."
		);
	}

	return messages || "";
};

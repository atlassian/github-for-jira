import { GitHubAPI } from "probot";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { GitHubInstallationClient } from "../../github/client/github-installation-client";

interface CompareCommitsPayload {
	owner: string;
	repo: string;
	base: string;
	head: string;
}

type CommitSummary = {
	sha: string;
	message: string;
}

// Used to compare commits for builds and deployments so we can
// obtain all issue keys referenced in commit messages.
export const getAllCommitMessagesBetweenReferences = async (
	payload: CompareCommitsPayload,
	github: GitHubAPI | GitHubInstallationClient,
	logger: LoggerWithTarget
): Promise<string> => {
	const commitSummaries = await getAllCommitsBetweenReferences(payload, github, logger);
	const messages = await extractMessagesFromCommitSummaries(commitSummaries);

	return messages || "";
};

// Used to compare commits for builds and deployments so we can
// obtain commit hashes and messages.
export const getAllCommitsBetweenReferences = async (
	payload: CompareCommitsPayload,
	github: GitHubAPI | GitHubInstallationClient,
	logger: LoggerWithTarget
): Promise<Array<CommitSummary>> => {
	let commitSummaries;
	try {
		const commitsDiff = github instanceof GitHubInstallationClient ? await github.compareReferences(payload.owner, payload.repo, payload.base, payload.head) : await github.repos.compareCommits(payload);
		commitSummaries = commitsDiff.data?.commits
			?.map((c) => { return { sha: c.sha, message: c.commit.message }; });
	} catch (err) {
		logger?.error(
			{ err, repo: payload.repo },
			"Failed to compare commits on repo."
		);
	}

	return commitSummaries;
};

// Used to extract messages from commit summaries so we can
// obtain all issue keys referenced in commit messages.
export const extractMessagesFromCommitSummaries = async (
	commitSummaries: Array<CommitSummary>
): Promise<string> => {
	const messages = commitSummaries
		?.map((c) => c.message)
		.join(" ");

	return messages || "";
};

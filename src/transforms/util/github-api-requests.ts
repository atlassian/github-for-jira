import Logger from "bunyan";
import { GitHubInstallationClient } from "../../github/client/github-installation-client";

interface CompareCommitsPayload {
	owner: string;
	repo: string;
	base: string;
	head: string;
}

export type CommitSummary = {
	sha: string;
	message: string;
}

// Used to compare commits for builds and deployments so we can
// obtain all issue keys referenced in commit messages.
export const getAllCommitMessagesBetweenReferences = async (
	payload: CompareCommitsPayload,
	gitHubInstallationClient: GitHubInstallationClient,
	logger: Logger
): Promise<string> => {
	const commitSummaries = await getAllCommitsBetweenReferences(payload, gitHubInstallationClient, logger);
	return extractMessagesFromCommitSummaries(commitSummaries);
};

// Used to compare commits for builds and deployments so we can
// obtain commit hashes and messages.
export const getAllCommitsBetweenReferences = async (
	payload: CompareCommitsPayload,
	gitHubInstallationClient: GitHubInstallationClient,
	logger: Logger
): Promise<CommitSummary[] | undefined> => {
	let commitSummaries;
	try {
		const commitsDiff = await gitHubInstallationClient.compareReferences(payload.owner, payload.repo, payload.base, payload.head);
		commitSummaries = commitsDiff.data?.commits
			?.map((c) => { return { sha: c.sha, message: c.commit.message }; });
	} catch (err: unknown) {
		logger?.debug(
			{ err, repo: payload.repo },
			"Failed to compare commits on repo."
		);
	}

	return commitSummaries;
};

// Used to extract messages from commit summaries so we can
// obtain all issue keys referenced in commit messages.
// Returns "" when there are no commit summaries.
export const extractMessagesFromCommitSummaries = (
	commitSummaries?: CommitSummary[]
): string => {
	const messages = commitSummaries
		?.map((c) => c.message)
		.join(" ");

	return messages || "";
};

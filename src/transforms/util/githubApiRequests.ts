import { GitHubAPI } from "probot";
import { LoggerWithTarget } from "probot/lib/wrap-logger";

interface CompareCommitsPayload {
	owner: string;
	repo: string;
	base: string;
	head: string;
}

export const compareCommitsBetweenBaseAndHeadBranches = async (
	payload: CompareCommitsPayload,
	github: GitHubAPI,
	logger?: LoggerWithTarget
): Promise<string | undefined | void> => {
	try {
		const commitsDiff = await github.repos.compareCommits(payload);
		logger?.info("COMMITS DIF: ", commitsDiff)
		return commitsDiff.data?.commits?.map((c) => c.commit.message).join(" ");
	} catch (err) {
		logger?.error(
			{ err, repo: payload.repo },
			"Failed to compare commits on repo."
		);
	}
};

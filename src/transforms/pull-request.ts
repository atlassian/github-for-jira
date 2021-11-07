import issueKeyParser from "jira-issue-key-parser";
import { getJiraId } from "../jira/util/id";
import _ from "lodash";
import { Octokit } from "@octokit/rest";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { getJiraAuthor } from "../util/jira";
import { GitHubAPI } from "probot";
import { getGithubUser } from "../services/github/user";
import { JiraAuthor } from "../interfaces/jira";

function mapStatus(status: string, merged_at?: string) {
	if (status === "merged") return "MERGED";
	if (status === "open") return "OPEN";
	if (status === "closed" && merged_at) return "MERGED";
	if (status === "closed" && !merged_at) return "DECLINED";
	return "UNKNOWN";
}

interface Review extends JiraAuthor {
	approvalStatus: string;
}

// TODO: define arguments and return
function mapReviews(reviews: Octokit.PullsListReviewsResponse = []) {
	const sortedReviews = _.orderBy(reviews, "submitted_at", "desc");
	const usernames: Record<string, Review> = {};
	// The reduce function goes through all the reviews and creates an array of unique users (so users' avatars won't be duplicated on the dev panel in Jira) and it considers 'APPROVED' as the main approval status for that user.
	return sortedReviews.reduce((acc: Review[], review) => {
		// Adds user to the usernames object if user is not yet added, then it adds that unique user to the accumulator.
		const author = review?.user;
		if (!usernames[author?.login]) {
			usernames[author?.login] = {
				...getJiraAuthor(author),
				approvalStatus: review.state === "APPROVED" ? "APPROVED" : "UNAPPROVED"
			};
			acc.push(usernames[author?.login]);
			// If user is already added (not unique) but the previous approval status is different than APPROVED and current approval status is APPROVED, updates approval status.
		} else if (
			usernames[author?.login].approvalStatus !== "APPROVED" &&
			review.state === "APPROVED"
		) {
			usernames[author?.login].approvalStatus = "APPROVED";
		}
		// Returns the reviews' array with unique users
		return acc;
	}, []);
}

// TODO: define arguments and return
export default async (github: GitHubAPI, pullRequest: Octokit.PullsGetResponse, reviews?: Octokit.PullsListReviewsResponse, log?: LoggerWithTarget) => {
	const { title: prTitle, head } = pullRequest;
	// This is the same thing we do in sync, concatenating these values
	const issueKeys = issueKeyParser().parse(
		`${prTitle}\n${pullRequest.head.ref}`
	);

	const logPayload = {
		prTitle: prTitle || "none",
		repoName: head?.repo.name || "none",
		prRef: pullRequest.head.ref || "none"
	}

	if (_.isEmpty(issueKeys) || !head?.repo) {
		log?.info(logPayload, "Ignoring pullrequest hence it has no issue keys or repo");
		return undefined;
	}

	const pullRequestStatus = mapStatus(pullRequest.state, pullRequest.merged_at);

	log?.info(logPayload, `Pull request status mapped to ${pullRequestStatus}`);

	return {
		id: pullRequest.base.repo.id,
		name: pullRequest.base.repo.full_name,
		url: pullRequest.base.repo.html_url,
		// Do not send the branch on the payload when the Pull Request Merged event is called.
		// Reason: If "Automatically delete head branches" is enabled, the branch deleted and PR merged events might be sent out “at the same time” and received out of order, which causes the branch being created again.
		branches:
			pullRequestStatus === "MERGED"
				? []
				: [
					{
						createPullRequestUrl: `${pullRequest?.head?.repo?.html_url}/pull/new/${pullRequest?.head?.ref}`,
						lastCommit: {
							// Need to get full name from a REST call as `pullRequest.head.user` doesn't have it
							author: getJiraAuthor(pullRequest.head?.user, await getGithubUser(github, pullRequest.head?.user?.login)),
							authorTimestamp: pullRequest.updated_at,
							displayId: pullRequest?.head?.sha?.substring(0, 6),
							fileCount: 0,
							hash: pullRequest.head.sha,
							id: pullRequest.head.sha,
							issueKeys,
							message: "n/a",
							updateSequenceId: Date.now(),
							url: `${pullRequest.head.repo.html_url}/commit/${pullRequest.head.sha}`
						},
						id: getJiraId(pullRequest.head.ref),
						issueKeys,
						name: pullRequest.head.ref,
						url: `${pullRequest.head.repo.html_url}/tree/${pullRequest.head.ref}`,
						updateSequenceId: Date.now()
					}
				],
		pullRequests: [
			{
				// Need to get full name from a REST call as `pullRequest.user.login` doesn't have it
				author: getJiraAuthor(pullRequest.user, await getGithubUser(github, pullRequest.user?.login)),
				commentCount: pullRequest.comments,
				destinationBranch: `${pullRequest.base.repo.html_url}/tree/${pullRequest.base.ref}`,
				displayId: `#${pullRequest.number}`,
				id: pullRequest.number,
				issueKeys,
				lastUpdate: pullRequest.updated_at,
				reviewers: mapReviews(reviews),
				sourceBranch: pullRequest.head.ref,
				sourceBranchUrl: `${pullRequest.head.repo.html_url}/tree/${pullRequest.head.ref}`,
				status: pullRequestStatus,
				timestamp: pullRequest.updated_at,
				title: pullRequest.title,
				url: pullRequest.html_url,
				updateSequenceId: Date.now()
			}
		],
		updateSequenceId: Date.now()
	};
};

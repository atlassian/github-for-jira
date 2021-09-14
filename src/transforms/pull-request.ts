import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../jira/util/isEmpty";
import { getJiraId } from "../jira/util/id";
import _ from "lodash";
import { Octokit } from "@octokit/rest";
import {LoggerWithTarget} from "probot/lib/wrap-logger";

function mapStatus(status: string, merged_at?: string) {
	if (status === "merged") return "MERGED";
	if (status === "open") return "OPEN";
	if (status === "closed" && merged_at) return "MERGED";
	if (status === "closed" && !merged_at) return "DECLINED";
	return "UNKNOWN";
}

// TODO: define arguments and return
function mapReviews(reviews) {
	reviews = reviews || [];
	const sortedReviews = _.orderBy(reviews, "submitted_at", "desc");
	const usernames = {};
	// The reduce function goes through all the reviews and creates an array of unique users (so users' avatars won't be duplicated on the dev panel in Jira) and it considers 'APPROVED' as the main approval status for that user.
	return sortedReviews.reduce((acc, review) => {
		// Adds user to the usernames object if user is not yet added, then it adds that unique user to the accumulator.
		const user = review?.user;
		if (!usernames[user?.login]) {
			usernames[user?.login] = {
				name: user?.login || undefined,
				approvalStatus: review.state === "APPROVED" ? "APPROVED" : "UNAPPROVED",
				url: user?.html_url || undefined,
				avatar: user?.avatar_url || undefined
			};
			acc.push(usernames[user?.login]);
			// If user is already added (not unique) but the previous approval status is different than APPROVED and current approval status is APPROVED, updates approval status.
		} else if (
			usernames[user?.login].approvalStatus !== "APPROVED" &&
			review.state === "APPROVED"
		) {
			usernames[user?.login].approvalStatus = "APPROVED";
		}
		// Returns the reviews' array with unique users
		return acc;
	}, []);
}

// TODO: define arguments and return
export default (pullRequest: Octokit.PullsGetResponse, reviews?: Octokit.PullsListReviewsResponse, log?: LoggerWithTarget) => {

	// This is the same thing we do in sync, concatenating these values
	const issueKeys = issueKeyParser().parse(
		`${pullRequest.title}\n${pullRequest.head.ref}`
	);

	if (isEmpty(issueKeys) || !pullRequest?.head?.repo) {
		log?.info("Ignoring pullrequest hence it has no issues or repo")
		return undefined;
	}

	const pullRequestStatus = mapStatus(pullRequest.state, pullRequest.merged_at);

	log?.info(`Pull request status mapped to ${pullRequestStatus}`)

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
							author: {
								name: pullRequest.head?.user?.login || undefined
							},
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
				author: {
					avatar: pullRequest.user?.avatar_url || undefined,
					name: pullRequest.user?.login || undefined,
					url: pullRequest.user?.html_url || undefined
				},
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

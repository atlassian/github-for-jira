import { isEmpty, omit, orderBy } from "lodash";
import { getJiraId } from "../jira/util/id";
import { Octokit } from "@octokit/rest";
import Logger from "bunyan";
import { getJiraAuthor, jiraIssueKeyParser } from "utils/jira-utils";
import { getGithubUser } from "services/github/user";
import { generateCreatePullRequestUrl } from "./util/pull-request-link-generator";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { JiraReview } from "../interfaces/jira";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";
import { pullRequestNode } from "~/src/github/client/github-queries";

const mapStatus = (status: string, merged_at?: string) => {
	if (status === "merged") return "MERGED";
	if (status === "open") return "OPEN";
	if (status === "closed" && merged_at) return "MERGED";
	if (status === "closed" && !merged_at) return "DECLINED";
	return "UNKNOWN";
};

interface JiraReviewer extends JiraReview {
	login: string;
}

const STATE_APPROVED = "APPROVED";
const STATE_UNAPPROVED = "UNAPPROVED";

const mapReviewsOld = async (reviews: Array<{ state?: string, user: Octokit.PullsUpdateResponseRequestedReviewersItem }> = [], gitHubInstallationClient: GitHubInstallationClient): Promise<JiraReview[]> => {

	const sortedReviews = orderBy(reviews, "submitted_at", "desc");
	const usernames: Record<string, JiraReviewer> = {};

	// The reduce function goes through all the reviews and creates an array of unique users
	// (so users' avatars won't be duplicated on the dev panel in Jira)
	// and it considers 'APPROVED' as the main approval status for that user.
	const reviewsReduced: JiraReviewer[] = sortedReviews.reduce((acc: JiraReviewer[], review) => {
		// Adds user to the usernames object if user is not yet added, then it adds that unique user to the accumulator.
		const reviewer = review?.user;
		const reviewerUsername = reviewer?.login;

		const haveWeSeenThisReviewerAlready = usernames[reviewerUsername];

		if (!haveWeSeenThisReviewerAlready) {
			usernames[reviewerUsername] = {
				...getJiraAuthor(reviewer),
				login: reviewerUsername,
				approvalStatus: review.state === STATE_APPROVED ? STATE_APPROVED : STATE_UNAPPROVED
			};

			acc.push(usernames[reviewerUsername]);

		} else if (usernames[reviewerUsername].approvalStatus !== STATE_APPROVED && review.state === STATE_APPROVED) {
			usernames[reviewerUsername].approvalStatus = STATE_APPROVED;
		}

		// Returns the reviews' array with unique users
		return acc;
	}, []);

	// Get GitHub user email, so it can be matched to an AAID
	return Promise.all(reviewsReduced.map(async reviewer => {
		const mappedReviewer = {
			...omit(reviewer, "login")
		};
		const isDeletedUser = !reviewer.login;
		if (!isDeletedUser) {
			const gitHubUser = await getGithubUser(gitHubInstallationClient, reviewer.login);
			mappedReviewer.email = gitHubUser?.email || `${reviewer.login}@noreply.user.github.com`;
		}
		return mappedReviewer;
	}));
};

export const extractIssueKeysFromPrOld = (pullRequest: Octokit.PullsListResponseItem) => {
	const { title: prTitle, head, body } = pullRequest;
	return jiraIssueKeyParser(`${prTitle}\n${head?.ref}\n${body}`);
};

export const extractIssueKeysFromPr = (pullRequest: pullRequestNode) => {
	const { title, headRef, body } = pullRequest;
	return jiraIssueKeyParser(`${title}\n${headRef?.name}\n${body}`);
};

// TODO: define arguments and return
export const transformPullRequest = async (
	gitHubInstallationClient: GitHubInstallationClient,
	pullRequest: Octokit.PullsGetResponse,
	reviews?: Array<{ state?: string, user: Octokit.PullsUpdateResponseRequestedReviewersItem }>,
	log?: Logger
) =>
{
	const { head } = pullRequest;

	const issueKeys = extractIssueKeysFromPrOld(pullRequest);

	// This is the same thing we do in sync, concatenating these values
	if (isEmpty(issueKeys) || !head?.repo) {
		log?.info({
			pullRequestNumber: pullRequest.number,
			pullRequestId: pullRequest.id
		}, "Ignoring pullrequest since it has no issue keys or repo");
		return undefined;
	}

	return {
		...transformRepositoryDevInfoBulk(pullRequest.base.repo, gitHubInstallationClient.baseUrl),
		branches: await getBranches(gitHubInstallationClient, pullRequest, issueKeys),
		pullRequests: [
			{
				// Need to get full name from a REST call as `pullRequest.user.login` doesn't have it
				author: getJiraAuthor(pullRequest.user, await getGithubUser(gitHubInstallationClient, pullRequest.user?.login)),
				commentCount: pullRequest.comments || 0,
				destinationBranch: pullRequest.base.ref || "",
				destinationBranchUrl: `${pullRequest.base.repo.html_url}/tree/${pullRequest.base.ref}`,
				displayId: `#${pullRequest.number}`,
				id: pullRequest.number,
				issueKeys,
				lastUpdate: pullRequest.updated_at,
				reviewers: await mapReviewsOld(reviews, gitHubInstallationClient),
				sourceBranch: pullRequest.head.ref || "",
				sourceBranchUrl: `${pullRequest.head.repo.html_url}/tree/${pullRequest.head.ref}`,
				status: mapStatus(pullRequest.state, pullRequest.merged_at),
				timestamp: pullRequest.updated_at,
				title: pullRequest.title,
				url: pullRequest.html_url,
				updateSequenceId: Date.now()
			}
		]
	};
};

// Do not send the branch on the payload when the Pull Request Merged event is called.
// Reason: If "Automatically delete head branches" is enabled, the branch deleted and PR merged events might be sent out “at the same time” and received out of order, which causes the branch being created again.
const getBranches = async (gitHubInstallationClient: GitHubInstallationClient, pullRequest: Octokit.PullsGetResponse, issueKeys: string[]) => {
	if (mapStatus(pullRequest.state, pullRequest.merged_at) === "MERGED") {
		return [];
	}
	return [
		{
			createPullRequestUrl: generateCreatePullRequestUrl(pullRequest?.head?.repo?.html_url, pullRequest?.head?.ref, issueKeys),
			lastCommit: {
				// Need to get full name from a REST call as `pullRequest.head.user` doesn't have it
				author: getJiraAuthor(pullRequest.head?.user, await getGithubUser(gitHubInstallationClient, pullRequest.head?.user?.login)),
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
	];
};

// TODO: TYPES N THINGS - reviews type and return type?
// this will default the current webhook oh no
export const transformPullRequestNew = (_jiraHost: string, pullRequest: pullRequestNode, reviews?: any, log?: Logger) => {
	const issueKeys = extractIssueKeysFromPr(pullRequest);

	if (isEmpty(issueKeys) || !pullRequest.headRef.repository) {
		log?.info({
			pullRequestNumber: pullRequest.number,
			pullRequestId: pullRequest.id
		}, "Ignoring pullrequest since it has no issue keys or repo");
		return undefined;
	}

	try {
		return {
			author: getJiraAuthor(pullRequest.author),
			commentCount: pullRequest.comments.totalCount || 0,
			destinationBranch: pullRequest.baseRef?.name || "",
			destinationBranchUrl: `https://github.com/${pullRequest.baseRef?.repository?.owner?.login}/${pullRequest.baseRef?.repository?.name}/tree/${pullRequest.baseRef?.name}`,
			displayId: `#${pullRequest.number}`,
			id: pullRequest.number,
			issueKeys,
			lastUpdate: pullRequest.updatedAt,
			reviewers: mapReviews(reviews.nodes),
			sourceBranch: pullRequest.headRef?.name || "",
			sourceBranchUrl: `https://github.com/${pullRequest.headRef?.repository?.owner?.login}/${pullRequest.headRef?.repository?.name}/tree/${pullRequest.headRef?.name}`,
			status: pullRequest.state, // test closed and declined behaviou// mapStatus(pullRequest.state, pullRequest.merged_at), mapStatus(pullRequest.state, pullRequest.mergedAt),
			timestamp: pullRequest.updatedAt,
			title: pullRequest.title,
			url: pullRequest.url,
			updateSequenceId: Date.now()
		};
	} catch (err) {
		throw new Error();
	}
};

// TODO: define arguments and return
// todo types
const mapReviews = (reviews: any = []): any[] => {
	const sortedReviews = orderBy(reviews, "submittedAt", "desc");
	const usernames: Record<string, any> = {};

	// The reduce function goes through all the reviews and creates an array of unique users
	// (so users' avatars won't be duplicated on the dev panel in Jira)
	// and it considers 'APPROVED' as the main approval status for that user.
	const reviewsReduced: any[] = sortedReviews.reduce((acc: any[], review) => {

		// Adds user to the usernames object if user is not yet added, then it adds that unique user to the accumulator.
		const reviewer = review?.author;
		const reviewerUsername = reviewer?.login;

		const haveWeSeenThisReviewerAlready = usernames[reviewerUsername];

		if (!haveWeSeenThisReviewerAlready) {
			usernames[reviewerUsername] = {
				...getJiraAuthor(reviewer),
				login: reviewerUsername,
				approvalStatus: review.state === STATE_APPROVED ? STATE_APPROVED : STATE_UNAPPROVED
			};

			acc.push(usernames[reviewerUsername]);

		} else if (usernames[reviewerUsername].approvalStatus !== STATE_APPROVED && review.state === STATE_APPROVED) {
			usernames[reviewerUsername].approvalStatus = STATE_APPROVED;
		}

		// Returns the reviews' array with unique users
		return acc;
	}, []);

	// Get GitHub user email, so it can be matched to an AAID
	return reviewsReduced.map(reviewer => {
		const mappedReviewer = {
			...omit(reviewer, "login")
		};
		const isDeletedUser = !reviewer.login;
		if (!isDeletedUser) {
			const gitHubUser = getJiraAuthor(reviewer);
			mappedReviewer.email = gitHubUser?.email || `${reviewer.login}@noreply.user.github.com`;
		}
		return mappedReviewer;
	});
};

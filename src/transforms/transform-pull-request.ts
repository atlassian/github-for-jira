import { isEmpty, omit } from "lodash";
import { getJiraId } from "../jira/util/id";
import { Octokit } from "@octokit/rest";
import Logger from "bunyan";
import { getJiraAuthor, jiraIssueKeyParser } from "utils/jira-utils";
import { getGithubUser } from "services/github/user";
import { generateCreatePullRequestUrl } from "./util/pull-request-link-generator";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { JiraReview } from "interfaces/jira";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";
import { pullRequestNode } from "~/src/github/client/github-queries";
import { booleanFlag, BooleanFlags, shouldSendAll } from "config/feature-flags";
import { getLogger } from "config/logger";
import { Repository } from "models/subscription";

export const mapStatus = (status: string, draft: boolean, merged_at?: string) => {
	if (status.toLowerCase() === "merged") return "MERGED";
	if (status.toLowerCase() === "open" && !draft) return "OPEN";
	if (status.toLowerCase() === "open" && draft) return "DRAFT";
	if (status.toLowerCase() === "closed" && merged_at) return "MERGED";
	if (status.toLowerCase() === "closed" && !merged_at) return "DECLINED";
	if (status.toLowerCase() === "declined") return "DECLINED";
	return "UNKNOWN";
};

interface JiraReviewer extends JiraReview {
	login: string;
}

// Data Depot valid ENUM values
const STATE_APPROVED = "APPROVED";
const STATE_UNAPPROVED = "UNAPPROVED";
const STATE_NEEDS_WORK = "NEEDSWORK";

const mapReviewState = (state: string | undefined) => {
	if (state === STATE_APPROVED) {
		return STATE_APPROVED;
	} else if (state === "CHANGES_REQUESTED") {
		return STATE_NEEDS_WORK;
	} else {
		return STATE_UNAPPROVED;
	}
};

const mapReviewsRest = async (reviews: Array<{ state?: string, user: Octokit.PullsUpdateResponseRequestedReviewersItem }> = [], gitHubInstallationClient: GitHubInstallationClient, logger: Logger): Promise<JiraReview[]> => {

	const usernames: Record<string, JiraReviewer> = {};

	// The reduce function goes through all the reviews and creates an array of unique users
	// (so users' avatars won't be duplicated on the dev panel in Jira)
	// and it considers 'APPROVED' as the main approval status for that user.
	const reviewsReduced: JiraReviewer[] = reviews.reduce((acc: JiraReviewer[], review) => {
		// Adds user to the usernames object if user is not yet added, then it adds that unique user to the accumulator.
		const reviewer = review?.user;
		const reviewerUsername = reviewer?.login;
		const haveWeSeenThisReviewerAlready = usernames[reviewerUsername];

		if (!haveWeSeenThisReviewerAlready) {
			usernames[reviewerUsername] = {
				...getJiraAuthor(reviewer),
				login: reviewerUsername,
				approvalStatus: mapReviewState(review.state)
			};

			acc.push(usernames[reviewerUsername]);

		} else {
			usernames[reviewerUsername].approvalStatus = mapReviewState(review.state);
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
			const gitHubUser = await getGithubUser(gitHubInstallationClient, reviewer.login, logger);
			mappedReviewer.email = gitHubUser?.email || `${reviewer.login}@noreply.user.github.com`;
		}
		return mappedReviewer;
	}));
};

export const extractIssueKeysFromPrRest = async (pullRequest: Octokit.PullsListResponseItem, jiraHost?: string) => {
	const { title: prTitle, head, body } = pullRequest;
	const logger = getLogger("extractIssueKeysFromPrRest");
	if (await booleanFlag(BooleanFlags.VERBOSE_LOGGING, jiraHost)) {
		logger.info({ prTitle }, `verbose logging: prTitle`);
	}
	return jiraIssueKeyParser(`${prTitle}\n${head?.ref}\n${body}`);
};

export const extractIssueKeysFromPr = (pullRequest: pullRequestNode) => {
	const { title, headRef, body } = pullRequest;
	return jiraIssueKeyParser(`${title}\n${headRef?.name ?? ""}\n${body}`);
};

export const transformPullRequestRest = async (
	gitHubInstallationClient: GitHubInstallationClient,
	pullRequest: Octokit.PullsGetResponse,
	reviews: Array<{ state?: string, user: Octokit.PullsUpdateResponseRequestedReviewersItem }>,
	log: Logger,
	jiraHost: string
) =>
{
	const {
		id,
		draft,
		user,
		comments,
		base,
		number: pullRequestNumber,
		updated_at,
		head,
		state,
		merged_at,
		title,
		html_url
	} = pullRequest;

	const issueKeys = await extractIssueKeysFromPrRest(pullRequest, jiraHost);

	// This is the same thing we do in sync, concatenating these values
	const alwaysSend = await shouldSendAll("prs", jiraHost, log);
	if ((isEmpty(issueKeys) && !alwaysSend) || !head?.repo) {
		log?.info({
			pullRequestNumber: pullRequestNumber,
			pullRequestId: id
		}, "Ignoring pullrequest since it has no issue keys or repo");
		return undefined;
	}

	const branches = await getBranches(gitHubInstallationClient, pullRequest, issueKeys, log);
	// Need to get full name from a REST call as `pullRequest.user.login` doesn't have it
	const author = getJiraAuthor(user, await getGithubUser(gitHubInstallationClient, user?.login, log));
	const reviewers = await mapReviewsRest(reviews, gitHubInstallationClient, log);
	const status = mapStatus(state, draft, merged_at);

	return {
		...transformRepositoryDevInfoBulk(base.repo, gitHubInstallationClient.baseUrl),
		branches,
		pullRequests: [
			{
				author,
				commentCount: comments || 0,
				destinationBranch: base.ref || "",
				destinationBranchUrl: `${base.repo.html_url}/tree/${base.ref}`,
				displayId: `#${pullRequestNumber}`,
				id: pullRequestNumber,
				issueKeys,
				lastUpdate: updated_at,
				reviewers,
				sourceBranch: pullRequest.head.ref || "",
				sourceBranchUrl: `${pullRequest.head.repo.html_url}/tree/${pullRequest.head.ref}`,
				status,
				timestamp: updated_at,
				title: title,
				url: html_url,
				updateSequenceId: Date.now()
			}
		]
	};
};

// Do not send the branch on the payload when the Pull Request Merged event is called.
// Reason: If "Automatically delete head branches" is enabled, the branch deleted and PR merged events might be sent out
// “at the same time” and received out of order, which causes the branch being created again.
const getBranches = async (gitHubInstallationClient: GitHubInstallationClient, pullRequest: Octokit.PullsGetResponse, issueKeys: string[], logger: Logger) => {
	if (mapStatus(pullRequest.state, pullRequest.draft, pullRequest.merged_at) === "MERGED") {
		return [];
	}

	return [
		{
			createPullRequestUrl: generateCreatePullRequestUrl(pullRequest?.head?.repo?.html_url, pullRequest?.head?.ref, issueKeys),
			lastCommit: {
				// Need to get full name from a REST call as `pullRequest.head.user` doesn't have it
				author: getJiraAuthor(pullRequest.head?.user, await getGithubUser(gitHubInstallationClient, pullRequest.head?.user?.login, logger)),
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

export const transformPullRequest = (repository: Repository, _jiraHost: string, pullRequest: pullRequestNode, alwaysSend: boolean, log: Logger) => {
	const issueKeys = extractIssueKeysFromPr(pullRequest);

	if (isEmpty(issueKeys) && !alwaysSend) {
		log.info({
			pullRequestNumber: pullRequest.number,
			pullRequestId: pullRequest.id
		}, "Ignoring pullrequest since it has no issue keys");
		return undefined;
	}

	const status = mapStatus(pullRequest.state, pullRequest.draft, pullRequest.mergedAt);

	return {
		author: getJiraAuthor(pullRequest.author),
		commentCount: pullRequest.comments.totalCount || 0,
		destinationBranch: pullRequest.baseRefName || "",
		destinationBranchUrl: `https://github.com/${repository.owner?.login}/${repository.name}/tree/${pullRequest.baseRefName}`,
		displayId: `#${pullRequest.number}`,
		id: pullRequest.number,
		issueKeys,
		lastUpdate: pullRequest.updatedAt,
		reviewers: mapReviews(pullRequest.reviews?.nodes, pullRequest.reviewRequests?.nodes),
		sourceBranch: pullRequest.headRefName,
		...(
			pullRequest.headRef
				? {
					sourceBranchUrl: `https://github.com/${pullRequest.headRef?.repository?.owner?.login}/${pullRequest.headRef?.repository?.name}/tree/${pullRequest.headRef?.name}`
				}
				: {}
		),
		status,
		timestamp: pullRequest.updatedAt,
		title: pullRequest.title,
		url: pullRequest.url,
		updateSequenceId: Date.now()
	};
};

const mapReviews = (reviews: pullRequestNode["reviews"]["nodes"] = [], reviewRequests: pullRequestNode["reviewRequests"]["nodes"] = []): JiraReview[] => {
	const allReviews = [...reviewRequests || [], ...reviews || []] as pullRequestNode["reviews"]["nodes"];
	const usernames: Record<string, JiraReviewer> = {};

	// The reduce function goes through all the reviews and creates an array of unique users
	// (so users' avatars won't be duplicated on the dev panel in Jira)
	// and it considers 'APPROVED' as the main approval status for that user.
	const reviewsReduced: JiraReviewer[] = allReviews.reduce((acc: JiraReviewer[], review) => {

		// Adds user to the usernames object if user is not yet added, then it adds that unique user to the accumulator.
		const reviewer = review?.author;
		const reviewerUsername = reviewer?.login;

		const haveWeSeenThisReviewerAlready = usernames[reviewerUsername];

		if (!haveWeSeenThisReviewerAlready) {
			usernames[reviewerUsername] = {
				...getJiraAuthor(reviewer),
				login: reviewerUsername,
				approvalStatus: mapReviewState(review.state)
			};

			acc.push(usernames[reviewerUsername]);

		} else {
			usernames[reviewerUsername].approvalStatus = mapReviewState(review.state);
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

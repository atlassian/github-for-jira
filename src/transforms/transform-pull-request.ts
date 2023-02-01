import { isEmpty, omit, orderBy } from "lodash";
import { getJiraId } from "../jira/util/id";
import { Octokit  } from "@octokit/rest";
import Logger from "bunyan";
import { getJiraAuthor, jiraIssueKeyParser } from "utils/jira-utils";
import { getGithubUser } from "services/github/user";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { generateCreatePullRequestUrl } from "./util/pull-request-link-generator";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { JiraReview } from "../interfaces/jira";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";

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

// TODO: define arguments and return
const mapReviews = async (reviews: Octokit.PullsListReviewsResponse = [], gitHubInstallationClient: GitHubInstallationClient): Promise<JiraReview[]> => {
	const sortedReviews = orderBy(reviews, "submitted_at", "desc");
	const usernames: Record<string, JiraReviewer> = {};
	// The reduce function goes through all the reviews and creates an array of unique users
	// (so users' avatars won't be duplicated on the dev panel in Jira)
	// and it considers 'APPROVED' as the main approval status for that user.
	const reviewsReduced: JiraReviewer[] = sortedReviews.reduce((acc: JiraReviewer[], review) => {
		// Adds user to the usernames object if user is not yet added, then it adds that unique user to the accumulator.
		const author = review?.user;

		if (!usernames[author?.login]) {
			usernames[author?.login] = {
				...getJiraAuthor(author),
				login: author.login,
				approvalStatus: review?.state === "APPROVED" ? "APPROVED" : "UNAPPROVED"
			};

			acc.push(usernames[author?.login]);
			// If user is already added (not unique) but the previous approval status is different
			// from APPROVED and current approval status is APPROVED, updates approval status.
		} else if (
			usernames[author?.login].approvalStatus !== "APPROVED" &&
			review.state === "APPROVED"
		) {
			usernames[author?.login].approvalStatus = "APPROVED";
		}

		// Returns the reviews' array with unique users
		return acc;
	}, []);

	// Get GitHub user email, so it can be matched to an AAID
	return Promise.all(reviewsReduced.map(async reviewer => {
		const gitHubUser = await getGithubUser(gitHubInstallationClient, reviewer.login);
		return {
			...omit(reviewer, "login"),
			email: gitHubUser?.email || `${reviewer.login}@noreply.user.github.com`
		};
	}));
};

// TODO: define arguments and return
export const transformPullRequest = async (gitHubInstallationClient: GitHubInstallationClient, pullRequest: Octokit.PullsGetResponse, reviews?: Octokit.PullsListReviewsResponse, log?: Logger) => {
	const { title: prTitle, head, body } = pullRequest;

	// This is the same thing we do in sync, concatenating these values
	const prBody = await booleanFlag(BooleanFlags.ASSOCIATE_PR_TO_ISSUES_IN_BODY) ? body : "";
	const issueKeys = jiraIssueKeyParser(`${prTitle}\n${head.ref}\n${prBody}}`);

	if (isEmpty(issueKeys) || !head?.repo) {
		log?.info({
			pullRequestNumber: pullRequest.number,
			pullRequestId: pullRequest.id
		}, "Ignoring pullrequest since it has no issue keys or repo");
		return undefined;
	}

	return {
		...await transformRepositoryDevInfoBulk(pullRequest.base.repo, gitHubInstallationClient.baseUrl),
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
				reviewers: await mapReviews(reviews, gitHubInstallationClient),
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

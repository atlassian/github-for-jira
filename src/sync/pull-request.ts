import transformPullRequest from "./transforms/pull-request";
import { GitHubAPI } from "probot";
import { getLogger } from "../config/logger";
import { Repository } from "../models/subscription";
import { getGithubPullRequests } from "../services/github/pull-requests";

const logger = getLogger("sync.pull-request");

export default async function(
	github: GitHubAPI,
	repository: Repository,
	cursor?:string
) {
	// TODO: use graphql here instead of rest API
	logger.info({ repository, cursor }, "Getting 100 Pull Requests");
	const pullRequests = await getGithubPullRequests(github, {
		owner: repository.owner.login,
		repoName: repository.name,
		cursor
	});

	// TODO: change this to reduce
	const jiraPullRequests = pullRequests.edges
		.map(edge => transformPullRequest(edge.node))
		.filter((value) => !!value);

	return {
		edges: pullRequests.edges,
		jiraPayload:
			jiraPullRequests?.length
				? {
					id: repository.id,
					name: repository.full_name,
					pullRequests: jiraPullRequests,
					url: repository.html_url,
					updateSequenceId: Date.now()
				}
				: undefined
	};
}

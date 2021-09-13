import transformBranches from "../transforms/branch";
import { getBranches as getBranchesQuery } from "../queries";
import { GitHubAPI } from "probot";

// TODO: better typings
export default async (github: GitHubAPI, repository, cursor, perPage) => {
	// TODO: fix typings for graphql
	const { edges } = ((await github.graphql(getBranchesQuery, {
		owner: repository.owner.login,
		repo: repository.name,
		per_page: perPage,
		cursor
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	})) as any).repository.refs;

	const branches = edges.map(({ node: item }) => {
		// translating the object into a schema that matches our transforms
		const associatedPullRequestTitle = (item.associatedPullRequests.nodes.length > 0)
			? item.associatedPullRequests.nodes[0].title
			: "";
		return {
			name: item.name,
			associatedPullRequestTitle,
			commits: item.target.history.nodes,
			lastCommit: {
				author: item.target.author,
				authorTimestamp: item.target.authoredDate,
				fileCount: 0,
				sha: item.target.oid,
				message: item.target.message,
				url: item.target.url || undefined
			}
		};
	});

	return {
		edges,
		jiraPayload: transformBranches({ branches, repository })
	};
};

import { getJiraId } from "../jira/util/id";
import { Context } from "probot/lib/context";
import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../jira/util/isEmpty";

async function getLastCommit(context: Context, issueKeys: string[]) {
	const { github, payload: { ref } } = context;

	const {
		data: { object: { sha } }
	} = await github.git.getRef(context.repo({ ref: `heads/${ref}` }));
	const {
		data: { commit, html_url: url }
	} = await github.repos.getCommit(context.repo({ ref: sha }));

	return {
		author: {
			name: commit.author.name
		},
		authorTimestamp: commit.author.date,
		displayId: sha.substring(0, 6),
		fileCount: 0,
		hash: sha,
		id: sha,
		issueKeys,
		message: commit.message,
		url,
		updateSequenceId: Date.now()
	};
}

// TODO: type this payload better
export default async (context: Context) => {
	if (context.payload.ref_type !== "branch") return undefined;

	const { ref, repository } = context.payload;

	const issueKeys = issueKeyParser().parse(ref);

	if (isEmpty(issueKeys)) {
		return undefined;
	}

	const lastCommit = await getLastCommit(context, issueKeys);

	// TODO: type this return
	return {
		id: repository.id,
		name: repository.full_name,
		url: repository.html_url,
		branches: [
			{
				createPullRequestUrl: `${repository.html_url}/pull/new/${ref}`,
				lastCommit,
				id: getJiraId(ref),
				issueKeys,
				name: ref,
				url: `${repository.html_url}/tree/${ref}`,
				updateSequenceId: Date.now()
			}
		],
		updateSequenceId: Date.now()
	};
};

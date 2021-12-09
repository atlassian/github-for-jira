export const githubPullReviewsResponse = [
	{
		id: 80,
		node_id: "MDE3OlB1bGxSZXF1ZXN0UmV2aWV3ODA=",
		user: {
			login: "test-pull-request-reviewer-login",
			id: 1,
			node_id: "MDQ6VXNlcjE=",
			avatar_url: "test-pull-request-reviewer-avatar",
			gravatar_id: "",
			url: "https://api.github.com/users/reviewer",
			html_url: "https://github.com/reviewer",
			followers_url: "https://api.github.com/users/reviewer/followers",
			following_url: "https://api.github.com/users/reviewer/following{/other_user}",
			gists_url: "https://api.github.com/users/reviewer/gists{/gist_id}",
			starred_url: "https://api.github.com/users/reviewer/starred{/owner}{/repo}",
			subscriptions_url: "https://api.github.com/users/reviewer/subscriptions",
			organizations_url: "https://api.github.com/users/reviewer/orgs",
			repos_url: "https://api.github.com/users/reviewer/repos",
			events_url: "https://api.github.com/users/reviewer/events{/privacy}",
			received_events_url: "https://api.github.com/users/reviewer/received_events",
			type: "User",
			site_admin: false
		},
		body: "Here is the body for the review.",
		state: "APPROVED",
		html_url: "https://github.com/test-repo-owner/test-repo-name/pull/1#pullrequestreview-80",
		pull_request_url: "https://api.github.com/repos/test-repo-owner/test-repo-name/pulls/1",
		_links: {
			html: {
				href: "https://github.com/test-repo-owner/test-repo-name/pull/1#pullrequestreview-80"
			},
			pull_request: {
				href: "https://api.github.com/repos/test-repo-owner/test-repo-name/pulls/1"
			}
		},
		submitted_at: "2019-11-17T17:43:43Z",
		commit_id: "ecdd80bb57125d7ba9641ffaa4d7d2c19d3f3091",
		author_association: "COLLABORATOR"
	}
];

export const githubRequestUserLoginResponse = {
	login: "test-pull-request-author-login",
	avatar_url: "test-pull-request-author-avatar",
	html_url: "test-pull-request-author-url"
}

export const jiraMatchingIssuesKeysBulkResponse = {
	preventTransitions: false,
	repositories: [
		{
			url: "test-pull-request-base-url",
			branches: [
				{
					createPullRequestUrl: "test-pull-request-head-url/pull/new/TEST-321-test-pull-request-head-ref",
					lastCommit: {
						author: {
							avatar: "https://github.com/ghost.png",
							name: "Deleted User",
							email: "deleted@noreply.user.github.com",
							url: "https://github.com/ghost"
						},
						authorTimestamp: "test-pull-request-update-time",
						displayId: "test-p",
						fileCount: 0,
						hash: "test-pull-request-sha",
						id: "test-pull-request-sha",
						issueKeys: ["TEST-123", "TEST-222", "TEST-321"],
						message: "n/a",
						updateSequenceId: 12345678,
						url: "test-pull-request-head-url/commit/test-pull-request-sha"
					},
					id: "TEST-321-test-pull-request-head-ref",
					issueKeys: ["TEST-123", "TEST-222", "TEST-321"],
					name: "TEST-321-test-pull-request-head-ref",
					url: "test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref",
					updateSequenceId: 12345678
				}
			],
			pullRequests: [
				{
					author: {
						avatar: "test-pull-request-author-avatar",
						name: "test-pull-request-author-login",
						email: "test-pull-request-author-login@noreply.user.github.com",
						url: "test-pull-request-author-url"
					},
					commentCount: "test-pull-request-comment-count",
					destinationBranch: "test-pull-request-base-url/tree/test-pull-request-base-ref",
					displayId: "#1",
					id: 1,
					issueKeys: ["TEST-123", "TEST-222", "TEST-321"],
					lastUpdate: "test-pull-request-update-time",
					reviewers: [
						{
							avatar: "test-pull-request-reviewer-avatar",
							name: "test-pull-request-reviewer-login",
							email: "test-pull-request-reviewer-login@noreply.user.github.com",
							url: "https://github.com/reviewer",
							approvalStatus: "APPROVED"
						}
					],
					sourceBranch: "TEST-321-test-pull-request-head-ref",
					sourceBranchUrl: "test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref",
					status: "OPEN",
					timestamp: "test-pull-request-update-time",
					title: "[TEST-123] [TEST-222] Test pull request.",
					url: "test-pull-request-url",
					updateSequenceId: 12345678
				}
			],
			updateSequenceId: 12345678
		}
	],
	properties: { installationId: 1234 }
};

export const jiraMultipleJiraBulkResponse = {
	preventTransitions: false,
	repositories: [
		{
			url: "test-pull-request-base-url",
			branches: [
				{
					createPullRequestUrl: "test-pull-request-head-url/pull/new/TEST-321-test-pull-request-head-ref",
					lastCommit: {
						author: {
							avatar: "https://github.com/ghost.png",
							name: "Deleted User",
							email: "deleted@noreply.user.github.com",
							url: "https://github.com/ghost"
						},
						authorTimestamp: "test-pull-request-update-time",
						displayId: "test-p",
						fileCount: 0,
						hash: "test-pull-request-sha",
						id: "test-pull-request-sha",
						issueKeys: ["TEST-123", "TEST-321"],
						message: "n/a",
						updateSequenceId: 12345678,
						url: "test-pull-request-head-url/commit/test-pull-request-sha"
					},
					id: "TEST-321-test-pull-request-head-ref",
					issueKeys: ["TEST-123", "TEST-321"],
					name: "TEST-321-test-pull-request-head-ref",
					url: "test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref",
					updateSequenceId: 12345678
				}
			],
			pullRequests: [
				{
					author: {
						avatar: "test-pull-request-author-avatar",
						name: "test-pull-request-author-login",
						email: "test-pull-request-author-login@noreply.user.github.com",
						url: "test-pull-request-author-url"
					},
					commentCount: "test-pull-request-comment-count",
					destinationBranch: "test-pull-request-base-url/tree/test-pull-request-base-ref",
					displayId: "#1",
					id: 1,
					issueKeys: ["TEST-123", "TEST-321"],
					lastUpdate: "test-pull-request-update-time",
					reviewers: [
						{
							avatar: "test-pull-request-reviewer-avatar",
							name: "test-pull-request-reviewer-login",
							email: "test-pull-request-reviewer-login@noreply.user.github.com",
							url: "https://github.com/reviewer",
							approvalStatus: "APPROVED"
						}
					],
					sourceBranch: "TEST-321-test-pull-request-head-ref",
					sourceBranchUrl: "test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref",
					status: "OPEN",
					timestamp: "test-pull-request-update-time",
					title: "[TEST-123] Test pull request.",
					url: "test-pull-request-url",
					updateSequenceId: 12345678
				}
			],
			updateSequenceId: 12345678
		}
	],
	properties: { installationId: 1234 }
};
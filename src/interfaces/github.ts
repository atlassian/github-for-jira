export interface GitHubPullRequest {
	head: {
		sha: string;
		repo: {
			url: string;
		};
		ref: string;
	};
}

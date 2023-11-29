export interface GitHubPullRequest {
	head: {
		sha: string;
		repo: {
			url: string;
		};
		ref: string;
	};
}

interface GitHubUser {
	avatar_url: string;
	events_url: string;
	followers_url: string;
	following_url: string;
	gists_url: string;
	gravatar_id: string;
	html_url: string;
	id: number;
	login: string;
	node_id: string;
	organizations_url: string;
	received_events_url: string;
	repos_url: string;
	site_admin: boolean;
	starred_url: string;
	subscriptions_url: string;
	type: string;
	url: string;
}

export interface GitHubIssue {
	status: number;
	body?: string;
	created_at?: string;
	html_url?: string;
	id?: number;
	node_id?: string;
	updated_at?: string;
	url?: string;
	user?: GitHubUser;
}


interface GitHubWorkflowRunAuthorAndCommitter {
	name: string;
	email: string;
}

interface GitHubWorkflowRunHeadCommit {
	id: string;
	tree_id: string;
	message: string;
	timestamp: Date;
	author: GitHubWorkflowRunAuthorAndCommitter;
	committer: GitHubWorkflowRunAuthorAndCommitter;
}

//refer from https://docs.github.com/en/rest/repos/repos#get-a-repository
interface GitHubWorkflowRunRepositoryOwner {
	login: string;
	id: number;
	name?: string;
	node_id: string;
	avatar_url: string;
	gravatar_id: string;
	url: string;
	html_url: string;
	followers_url: string;
	following_url: string;
	gists_url: string;
	starred_url: string;
	subscriptions_url: string;
	organizations_url: string;
	repos_url: string;
	events_url: string;
	received_events_url: string;
	type: string;
	site_admin: boolean;
}

interface GitHubWorkflowRunRepository {
	id: number;
	node_id: string;
	name: string;
	full_name: string;
	private: boolean;
	owner: GitHubWorkflowRunRepositoryOwner;
	html_url: string;
	description: string | null;
	fork: boolean;
	url: string;
	forks_url: string;
	keys_url: string;
	collaborators_url: string;
	teams_url: string;
	hooks_url: string;
	issue_events_url: string;
	events_url: string;
	assignees_url: string;
	branches_url: string;
	tags_url: string;
	blobs_url: string;
	git_tags_url: string;
	git_refs_url: string;
	trees_url: string;
	statuses_url: string;
	languages_url: string;
	stargazers_url: string;
	contributors_url: string;
	subscribers_url: string;
	subscription_url: string;
	commits_url: string;
	git_commits_url: string;
	comments_url: string;
	issue_comment_url: string;
	contents_url: string;
	compare_url: string;
	merges_url: string;
	archive_url: string;
	downloads_url: string;
	issues_url: string;
	pulls_url: string;
	milestones_url: string;
	notifications_url: string;
	labels_url: string;
	releases_url: string;
	deployments_url: string;
}

interface GitHubWorkflowRunPullRequestsHeadAndBaseRepo {
	id: number;
	url: string;
	name: string;
}

interface GitHubWorkflowRunPullRequestsHeadAndBase {
	ref: string;
	sha: string;
	repo: GitHubWorkflowRunPullRequestsHeadAndBaseRepo;
}


interface GitHubWorkflowRunPullRequests {
	url: string;
	id: number;
	number: number;
	head: GitHubWorkflowRunPullRequestsHeadAndBase;
	base: GitHubWorkflowRunPullRequestsHeadAndBase;
}

interface GitHubWorkflowRun {
	name: string;
	head_branch: string;
	run_number: number;
	status: string;
	conclusion: string | undefined;
	html_url: string;
	pull_requests: GitHubWorkflowRunPullRequests[];
	updated_at: string;
	// Can be null according to https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28 (see response schema)
	head_commit: GitHubWorkflowRunHeadCommit | null;
	repository: GitHubWorkflowRunRepository;
	workflow_id: number;
}

export interface GitHubWorkflowPayload {
	workflow_run: GitHubWorkflowRun;
}

interface GitHubData {
	body: string;
	owner: string;
	repo: string;
}

export interface GitHubIssueCommentData extends GitHubData {
	comment_id: number;
}

export interface GitHubIssueData extends GitHubData {
	issue_number: number;
}

export interface GitHubRepository extends GitHubWorkflowRunRepository {
	created_at: number;
	updated_at: string;
	pushed_at: number;
	git_url: string;
	ssh_url: string;
	clone_url: string;
	svn_url: string;
	homepage?: string;
	size: number;
	stargazers_count: number;
	watchers_count: number;
	language?: string;
	has_issues: boolean;
	has_projects: boolean;
	has_downloads: boolean;
	has_wiki: boolean;
	has_pages: boolean;
	forks_count: number;
	mirror_url?: string;
	archived: boolean;
	disabled: boolean;
	open_issues_count: number;
	license?: string;
	allow_forking: boolean;
	is_template: boolean;
	topics: string[];
	visibility: string;
	forks: number;
	open_issues: number;
	watchers: number;
	default_branch: string;
	stargazers: number;
	master_branch: string;
}

interface GitHubInstallation {
	id: number;
	node_id: number;
}

//refer from here https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#push
//TODO: tbh |  I think we should use a better typing |  something more official
export interface GitHubCommit {
	id: string;
	message: string;
	timestamp: string;
	author: {
		name: string;
		email: string;
	};
	url: string;
	distinct: boolean;
	added: GithubCommitFile[];
	modified: GithubCommitFile[];
	removed: GithubCommitFile[];
}

export interface GithubCommitFile {
	filename: string;
	additions: number;
	deletions: number;
	changes: number;
	status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
	raw_url: string;
	blob_url: string;
	patch: string;
}

export interface GitHubPushData {
	webhookId: string;
	webhookReceived: number;
	repository: GitHubRepository;
	commits: GitHubCommit[];
	installation: GitHubInstallation;
}

export interface GitHubVulnIdentifier {
	value: string;
	type: string;
}

export interface GitHubVulnReference {
	url: string;
}

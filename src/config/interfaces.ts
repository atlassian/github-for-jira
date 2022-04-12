import { Octokit } from "@octokit/rest";

interface FailedInstallationsRequestHeaders {
	accept: string;
	"user-agent": string;
	authorization: string;
}

interface FailedInstallationsRequestObjectValidateId {
	required: boolean;
	type: string;
}

interface FailedInstallationsRequestObjectValidate {
	installation_id: FailedInstallationsRequestObjectValidateId;
}

interface FailedInstallationsRequestObject {
	validate: FailedInstallationsRequestObjectValidate;
}

interface FailedInstallationRequest {
	method: string;
	url: string;
	headers: FailedInstallationsRequestHeaders;
	request: FailedInstallationsRequestObject;
}

interface FailedInstallationError {
	status: number;
	headers: Record<string, string>;
	request: FailedInstallationRequest;
	documentation_url: string;
}

export interface AppInstallation extends Octokit.AppsGetInstallationResponse {
	syncStatus?: string;
	syncWarning?: string;
	totalNumberOfRepos: number;
	numberOfSyncedRepos: number;
	jiraHost: string;
}

export interface FailedAppInstallation {
	error: FailedInstallationError;
	id: number;
	deleted: boolean;
}

interface WorkflowRunAuthorAndCommitter {
	name: string;
	email: string;
}

interface WorkflowRunHeadCommit {
	id: string;
	tree_id: string;
	message: string;
	timestamp: Date;
	author: WorkflowRunAuthorAndCommitter;
	committer: WorkflowRunAuthorAndCommitter;
}

interface WorkflowRunRepositoryOwner {
	login: string;
	id: number;
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

interface WorkflowRunRepository {
	id: number;
	node_id: string;
	name: string;
	full_name: string;
	private: boolean;
	owner: WorkflowRunRepositoryOwner;
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

interface WorkflowRunPullRequestsHeadAndBaseRepo {
	id: number;
	url: string;
	name: string;
}

interface WorkflowRunPullRequestsHeadAndBase {
	ref: string;
	sha: string;
	repo: WorkflowRunPullRequestsHeadAndBaseRepo;
}


interface WorkflowRunPullRequests {
	url: string;
	id: number;
	number: number;
	head: WorkflowRunPullRequestsHeadAndBase;
	base: WorkflowRunPullRequestsHeadAndBase;
}

interface WorkflowRun {
	name: string;
	head_branch: string;
	run_number: number;
	status: string;
	conclusion: string | undefined;
	html_url: string;
	pull_requests: WorkflowRunPullRequests[];
	updated_at: string;
	head_commit: WorkflowRunHeadCommit;
	repository: WorkflowRunRepository;
}

interface Workflow {
	id: string;
}

export interface WorkflowPayload {
	workflow_run: WorkflowRun;
	workflow: Workflow;
}
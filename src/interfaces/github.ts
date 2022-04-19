import { stringList } from "aws-sdk/clients/datapipeline";
import { Review } from "src/transforms/pull-request";
import { JiraAuthor, JiraBranch, JiraCommit } from './jira';

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

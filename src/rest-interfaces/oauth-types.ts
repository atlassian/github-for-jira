export type GetRedirectUrlResponse = {
	redirectUrl: string;
};

export type ExchangeTokenResponse = {
	accessToken: string;
	refreshToken: string;
};

export type UsersGetAuthenticatedResponse = {
	avatar_url: string;
	bio: string;
	blog: string;
	collaborators?: number;
	company: string;
	created_at: string;
	disk_usage?: number;
	email: string;
	events_url: string;
	followers: number;
	followers_url: string;
	following: number;
	following_url: string;
	gists_url: string;
	gravatar_id: string;
	hireable: boolean;
	html_url: string;
	id: number;
	location: string;
	login: string;
	name: string;
	node_id: string;
	organizations_url: string;
	owned_private_repos?: number;
	private_gists?: number;
	public_gists: number;
	public_repos: number;
	received_events_url: string;
	repos_url: string;
	site_admin: boolean;
	starred_url: string;
	subscriptions_url: string;
	total_private_repos?: number;
	two_factor_authentication?: boolean;
	type: string;
	updated_at: string;
	url: string;
};

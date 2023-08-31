import Avatar from "@atlaskit/avatar";
import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";

export const presidents = [
	{
		id: 1,
		name: "George Washington",
		party: "None, Federalist",
		term: "1789-1797",
	},
	{
		id: 2,
		name: "John Adams",
		party: "Federalist",
		term: "1797-1801",
	},
	{
		id: 3,
		name: "Thomas Jefferson",
		party: "Democratic-Republican",
		term: "1801-1809",
	},
	{
		id: 4,
		name: "James Madison",
		party: "Democratic-Republican",
		term: "1809-1817",
	},
];

export type Account = {
	login: string;
	id: number;
	avatar_url: string;
	type?: string;
	site_admin?: boolean;
};

export type SuccessfulCloudConnection = {
	id: number;
	account: Account;
	repository_selection: string;
	app_id: number;
	app_slug: string;
	target_id: number;
	target_type: string;
	created_at: string;
	updated_at: string;
	syncStatus: string;
	totalNumberOfRepos: number;
	numberOfSyncedRepos: number;
	jiraHost: string;
	isGlobalInstall: boolean;
};

export type FailedCloudConnection = {};

export type GhCloudSubscriptions = {
	successfulCloudConnections: SuccessfulCloudConnection[];
	failedCloudConnections: FailedCloudConnection[];
};

export type SuccessfulConnection = {
	id: number;
	account: Account;
	repository_selection: string;
	app_id: number;
	target_id: number;
	target_type: string;
	created_at: string;
	updated_at: string;
	syncStatus: string;
	totalNumberOfRepos: number;
	numberOfSyncedRepos: number;
	jiraHost: string;
	isGlobalInstall: boolean;
};

export type FailedConnection = {
	id: number;
	deleted: boolean;
	orgName?: string;
};

export type Installation = {
	id: number;
	account: Account;
	target_type: string;
	created_at: string;
	updated_at: string;
	syncStatus: string;
	totalNumberOfRepos: number;
	numberOfSyncedRepos: number;
	backfillSince: null | string;
	jiraHost: string;
};

export type GitHubApplication = {
	id: number;
	uuid: string;
	appId: number;
	gitHubBaseUrl: string;
	gitHubClientId: string;
	gitHubAppName: string;
	installationId: number;
	createdAt: string;
	updatedAt: string;
	successfulConnections: SuccessfulConnection[];
	failedConnections: FailedConnection[];
	installations: {
		fulfilled: Installation[];
		rejected: any[];
		total: number;
	};
};

export type GhEnterpriseServer = {
	gitHubBaseUrl: string;
	applications: GitHubApplication[];
};

export type GHSUbscriptions = {
	ghCloudSubscriptions: GhCloudSubscriptions;
	ghEnterpriseServers: GhEnterpriseServer[];
};

interface President {
	id: number;
	name: string;
	party: string;
	term: string;
}

const NameWrapper = styled.span`
	display: flex;
	align-items: center;
`;

const AvatarWrapper = styled.span`
	marginright: ${token("space.200")};
`;

export const caption = "List of US Presidents";

export const createHead = (withWidth: boolean) => {
	return {
		cells: [
			{
				key: "name",
				content: "Name",
				width: withWidth ? 25 : undefined,
			},
			{
				key: "party",
				content: "Party",
				width: withWidth ? 25 : undefined,
			},
			{
				key: "term",
				content: "Term",
				width: withWidth ? 25 : undefined,
			},
			{
				key: "content",
				content: "Comment",
				width: withWidth ? 25 : undefined,
			},
		],
	};
};

export const head = createHead(true);

export const rows = presidents.map((president: President, index: number) => ({
	key: `row-${index}-${president.name}`,
	isHighlighted: false,
	cells: [
		{
			key: president.name,
			content: (
				<NameWrapper>
					<AvatarWrapper>
						<Avatar name={president.name} size="medium" />
					</AvatarWrapper>
					<a href="https://atlassian.design">{president.name}</a>
				</NameWrapper>
			),
		},
		{
			key: president.party,
			content: president.party,
		},
		{
			key: president.id,
			content: president.term,
		},
		{
			key: "Lorem",
			content: president.term,
		},
	],
}));

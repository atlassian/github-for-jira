import Avatar from "@atlaskit/avatar";
import styled from "@emotion/styled";
import Badge from "@atlaskit/badge";
import { token } from "@atlaskit/tokens";
import Lozenge from "@atlaskit/lozenge";
import EditIcon from "@atlaskit/icon/glyph/edit";
import MoreIcon from "@atlaskit/icon/glyph/more";


export type Row = {
	key: string;
	isHighlighted: boolean;
	cells: { key: string | number; content: JSX.Element | string | number }[];
};

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
	syncWarning: string;
	backfillSince: string | null;
	totalNumberOfRepos: number;
	numberOfSyncedRepos: number;
	jiraHost: string;
	isGlobalInstall: boolean;
};

export type FailedCloudConnection = {
	id: number;
	deleted: boolean;
	orgName?: string;
};

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
	backfillSince: string | null;
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

export type GitHubEnterpriseApplication = {
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
	applications: GitHubEnterpriseApplication[];
};

export type GHSUbscriptions = {
	ghCloudSubscriptions: GhCloudSubscriptions;
	ghEnterpriseServers: GhEnterpriseServer[];
};

const RowWrapper = styled.div`
	display: flex;
	align-items: center;
`;

const AvatarWrapper = styled.span`
	marginright: ${token("space.200")};
`;

const ifAllReposSynced = (
	numberOfSyncedRepos: number,
	totalNumberOfRepos: number
) =>
	numberOfSyncedRepos === totalNumberOfRepos
		? totalNumberOfRepos
		: `${numberOfSyncedRepos} / ${totalNumberOfRepos}`;

export const isAllSyncSuccess = (connection?: SuccessfulCloudConnection) => {
	return connection &&
		connection.syncStatus === "FINISHED" &&
		!connection.syncWarning
		? true
		: false;
};


export const createHead = (withWidth: boolean) => {
	return {
		cells: [
			{
				key: "name",
				content: "Name",
				width: withWidth ? 30 : undefined,
			},
			{
				key: "party",
				content: "Party",
				width: withWidth ? 30 : undefined,
			},
			{
				key: "term",
				content: "Term",
				width: withWidth ? 30 : undefined,
			},
			{
				key: "content",
				content: "Comment",
				width: withWidth ? 10 : undefined,
			},
		],
	};
};

export const head = createHead(true);

export const getGHCloudSubscriptionsRows = (
	ghCloudSubscriptions: GhCloudSubscriptions | null
): Row[] => {
	if (!ghCloudSubscriptions) {
		return [];
	}
	const successfulCloudConnections: SuccessfulCloudConnection[] =
		ghCloudSubscriptions.successfulCloudConnections;
	return successfulCloudConnections.map(
		(cloudConnection: SuccessfulCloudConnection, index: number) => ({
			key: `row-${index}-${cloudConnection.id}`,
			isHighlighted: false,
			cells: [
				{
					key: cloudConnection.account.login,
					content: (
						<RowWrapper>
							<AvatarWrapper>
								<Avatar
									name={cloudConnection.account.login}
									src={cloudConnection.account.avatar_url}
									size="medium"
								/>
							</AvatarWrapper>
							<a href="https://atlassian.design">
								{cloudConnection.account.login}
							</a>
						</RowWrapper>
					),
				},
				{
					key: cloudConnection.account.login,
					content: (
						<RowWrapper>
							<span>
								{cloudConnection.isGlobalInstall
									? `All repos`
									: `Only select repos`}
							</span>
							<Badge>
								{ifAllReposSynced(
									cloudConnection.numberOfSyncedRepos,
									cloudConnection.totalNumberOfRepos
								)}
							</Badge>
							<EditIcon label="" />
						</RowWrapper>
					),
				},
				{
					key: cloudConnection.id,
					content: (
						<RowWrapper>
							<Lozenge appearance="success" maxWidth="500">
								{cloudConnection.syncStatus}
							</Lozenge>
							{isAllSyncSuccess(cloudConnection) && (
								<>
									{cloudConnection.backfillSince ? (
										<>
											<span>
												Backfilled from:
												{new Date(
													cloudConnection.backfillSince
												).toLocaleDateString("en-GB")}
											</span>
										</>
									) : (
										`All commits backfilled`
									)}
								</>
							)}
						</RowWrapper>
					),
				},
				{
					key: "Lorem",
					content: (
						<RowWrapper>
							<MoreIcon label="" />
						</RowWrapper>
					),
				},
			],
		})
	);
};


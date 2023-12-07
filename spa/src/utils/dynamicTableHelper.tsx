/** @jsxImportSource @emotion/react */
import Avatar from "@atlaskit/avatar";
import Badge from "@atlaskit/badge";
import { token } from "@atlaskit/tokens";
import Lozenge from "@atlaskit/lozenge";
import { BackfillPageModalTypes, SuccessfulConnection } from "../rest-interfaces";
import { ThemeAppearance } from "@atlaskit/lozenge/dist/types/Lozenge";
import { css } from "@emotion/react";

type Row = {
	key: string;
	isHighlighted: boolean;
	cells: { key: string | number; content: React.JSX.Element | string | number }[];
};

type ConnectionsActionsCallback = {
	setIsModalOpened: (x: boolean) => void;
	setSubscriptionForModal: (sub: SuccessfulConnection) => void;
	setSelectedModal: (x: BackfillPageModalTypes) => void;
};

const rowWrapperStyle = css`
	display: flex;
	align-items: center;
`;
const avatarWrapperStyle = css`
	margin-right: ${token("space.200")};
`;

const ifAllReposSynced = (
	numberOfSyncedRepos: number,
	totalNumberOfRepos: number
): number | string => {
	if (!totalNumberOfRepos) return ""; // If the total number of repos is 0, then show nothing
	if (numberOfSyncedRepos === totalNumberOfRepos) {
		return totalNumberOfRepos;
	} else {
		return `${numberOfSyncedRepos} / ${totalNumberOfRepos}`;
	}
};

const mapSyncStatus = (status: string): ThemeAppearance => {
	switch (status) {
		case "IN PROGRESS":
			return "inprogress";
		case "FINISHED":
			return "success";
		case "FAILED":
			return "removed";
		default:
			return "default";
	}
};

const isAllSyncSuccess = (connection?: SuccessfulConnection) => connection && connection.syncStatus === "FINISHED" && !connection.syncWarning;

const createHead = (withWidth: boolean) => {
	return {
		cells: [
			{
				key: "name",
				content: "Name",
				width: withWidth ? 30 : undefined,
			},
			{
				key: "repos",
				content: "Repos",
				width: withWidth ? 30 : undefined,
			},
			{
				key: "status",
				content: "Status",
				width: withWidth ? 30 : undefined,
			},
			{
				key: "options",
				content: "Settings",
				width: withWidth ? 10: undefined,
			}
		],
	};
};

export const head = createHead(true);

export const getGHSubscriptionsRows = (
	SuccessfulConnections: SuccessfulConnection[],
	callbacks?: ConnectionsActionsCallback
): Row[] => {
	if (!SuccessfulConnections) {
		return [];
	}
	return SuccessfulConnections.map(
		(cloudConnection: SuccessfulConnection, index: number) => ({
			key: `row-${index}-${cloudConnection.id}`,
			isHighlighted: false,
			cells: [
				{
					key: cloudConnection.account.login,
					content: (
						<div css={rowWrapperStyle}>
							{cloudConnection.account.avatar_url && (
								<span css={avatarWrapperStyle}>
									<Avatar
										name={cloudConnection.account.login}
										src={cloudConnection.account.avatar_url}
										size="medium"
									/>
								</span>
							)}

							<span>{cloudConnection.account.login}</span>
						</div>
					),
				},
				{
					key: cloudConnection.account.login,
					content: (
						<div css={rowWrapperStyle}>
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
						</div>
					),
				},
				{
					key: cloudConnection.id,
					content: (
						<div css={rowWrapperStyle}>
							<div>
								<Lozenge appearance={mapSyncStatus(cloudConnection.syncStatus)} maxWidth="500">
									{cloudConnection.syncStatus}
								</Lozenge>
								<br/>
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
							</div>
						</div>
					),
				},
				{
					key: cloudConnection.id,
					content: (
						<>
							{/* TODO: Convert this into a dropdown */}
							<div onClick={() => {
								callbacks?.setIsModalOpened(true);
								callbacks?.setSubscriptionForModal(cloudConnection);
								callbacks?.setSelectedModal("DISCONNECT_SUBSCRIPTION");
							}}>
								Disconnect
							</div>
							<div onClick={() => {
								callbacks?.setIsModalOpened(true);
								callbacks?.setSubscriptionForModal(cloudConnection);
								callbacks?.setSelectedModal("BACKFILL");
							}}>
								Backfill
							</div>
						</>
					)
				}
			],
		})
	);
};

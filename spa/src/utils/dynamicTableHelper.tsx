import Avatar from "@atlaskit/avatar";
import styled from "@emotion/styled";
import Badge from "@atlaskit/badge";
import { token } from "@atlaskit/tokens";
import Lozenge from "@atlaskit/lozenge";
import { SuccessfulConnection } from "../rest-interfaces";
import { ThemeAppearance } from "@atlaskit/lozenge/dist/types/Lozenge";

type Row = {
	key: string;
	isHighlighted: boolean;
	cells: { key: string | number; content: React.JSX.Element | string | number }[];
};

// eslint-disable-next-line react-refresh/only-export-components
const RowWrapper = styled.div`
	display: flex;
	align-items: center;
`;
// eslint-disable-next-line react-refresh/only-export-components
const AvatarWrapper = styled.span`
	margin-right: ${token("space.200")};
`;

const ifAllReposSynced = (
	numberOfSyncedRepos: number,
	totalNumberOfRepos: number
): number | string =>
	numberOfSyncedRepos === totalNumberOfRepos ? totalNumberOfRepos :
		(totalNumberOfRepos ? `${numberOfSyncedRepos} / ${totalNumberOfRepos}` : "");

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
				key: "party",
				content: "Repos",
				width: withWidth ? 30 : undefined,
			},
			{
				key: "term",
				content: "Status",
				width: withWidth ? 30 : undefined,
			}
		],
	};
};

export const head = createHead(true);

export const getGHSubscriptionsRows = (
	SuccessfulConnections: SuccessfulConnection[]
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
						<RowWrapper>
							{cloudConnection.account.avatar_url && (
								<AvatarWrapper>
									<Avatar
										name={cloudConnection.account.login}
										src={cloudConnection.account.avatar_url}
										size="medium"
									/>
								</AvatarWrapper>
							)}

							<span>{cloudConnection.account.login}</span>
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
						</RowWrapper>
					),
				},
				{
					key: cloudConnection.id,
					content: (
						<RowWrapper>
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
						</RowWrapper>
					),
				}
			],
		})
	);
};

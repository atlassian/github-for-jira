/** @jsxImportSource @emotion/react */
import { useState } from "react";
import { DynamicTableStateless } from "@atlaskit/dynamic-table";
import {
	head,
	getGHSubscriptionsRows,
} from "../../../utils/dynamicTableHelper";
import { BackfillPageModalTypes, GhCloudSubscriptions } from "../../../rest-interfaces";
import { Box, xcss } from "@atlaskit/primitives";
import { SuccessfulConnection } from "rest-interfaces";
import DisconnectSubscriptionModal from "../Modals/DisconnectSubscriptionModal";
import RestartBackfillModal from "../Modals/RestartBackfillModal";
import { ModalTransition } from "@atlaskit/modal-dialog";

const containerStyles = xcss({
	display: "flex",
	flexDirection: "column",
});

type GitHubCloudConnectionsProps = {
	ghCloudSubscriptions: GhCloudSubscriptions;
	refetch: () => void;
};

const GitHubCloudConnections = ({
	ghCloudSubscriptions,
	refetch,
}: GitHubCloudConnectionsProps) => {
	const [isModalOpened, setIsModalOpened] = useState(false);
	const [subscriptionForModal, setSubscriptionForModal] = useState<SuccessfulConnection | undefined>(undefined);
	const [selectedModal, setSelectedModal] = useState<BackfillPageModalTypes>("BACKFILL");

	const openedModal = (refetch: () => void) => {
		switch (selectedModal) {
			case "BACKFILL":
				return (<RestartBackfillModal
					subscription={subscriptionForModal as SuccessfulConnection}
					setIsModalOpened={setIsModalOpened}
					refetch={refetch}
				/>);
			case "DISCONNECT_SUBSCRIPTION":
				return <DisconnectSubscriptionModal
					subscription={subscriptionForModal as SuccessfulConnection}
					setIsModalOpened={setIsModalOpened}
					refetch={refetch}
				/>;
			// 	TODO: Create modals for GHE later
			case "DISCONNECT_SERVER":
			case "DISCONNECT_SERVER_APP":
			default:
				return <></>;
		}
	};

	return (
		<>
			<Box xcss={containerStyles}>
				<DynamicTableStateless
					head={head}
					rows={getGHSubscriptionsRows(
						ghCloudSubscriptions.successfulCloudConnections,
						{ setIsModalOpened, setSubscriptionForModal, setSelectedModal }
					)}
					rowsPerPage={5}
					page={1}
				/>
			</Box>

			<ModalTransition>
				{
					isModalOpened && subscriptionForModal && openedModal(refetch)
				}
			</ModalTransition>
		</>
	);
};

export default GitHubCloudConnections;

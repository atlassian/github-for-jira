/** @jsxImportSource @emotion/react */
import { Box, xcss } from "@atlaskit/primitives";
import { DynamicTableStateless } from "@atlaskit/dynamic-table";
import {
	head,
	getGHSubscriptionsRows,
} from "../../../utils/dynamicTableHelper";
import {
	BackfillPageModalTypes,
	GhCloudSubscriptions, SuccessfulConnection,
} from "../../../rest-interfaces";

const containerStyles = xcss({
	display: "flex",
	flexDirection: "column",
});

type GitHubCloudConnectionsProps = {
	ghCloudSubscriptions: GhCloudSubscriptions;
	setDataForModal: (dataForModal: SuccessfulConnection | undefined) => void,
	setSelectedModal: (selectedModal:BackfillPageModalTypes) => void,
	setIsModalOpened: (isModalOpen: boolean) => void,
};

const GitHubCloudConnections = ({
	ghCloudSubscriptions,
	setIsModalOpened,
	setDataForModal,
	setSelectedModal,
}: GitHubCloudConnectionsProps) => {
	return (
		<>
			<Box xcss={containerStyles}>
				<DynamicTableStateless
					head={head}
					rows={getGHSubscriptionsRows(
						ghCloudSubscriptions.successfulCloudConnections,
						{ setIsModalOpened, setDataForModal, setSelectedModal }
					)}
					rowsPerPage={5}
					page={1}
				/>
			</Box>
		</>
	);
};

export default GitHubCloudConnections;

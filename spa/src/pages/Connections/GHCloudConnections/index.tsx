/** @jsxImportSource @emotion/react */
import { DynamicTableStateless } from "@atlaskit/dynamic-table";
import {
	head,
	getGHSubscriptionsRows,
} from "../../../utils/dynamicTableHelper";
import { GhCloudSubscriptions } from "../../../rest-interfaces";
import { Box, xcss } from "@atlaskit/primitives";

const containerStyles = xcss({
	display: "flex",
	flexDirection: "column",
});

type GitHubCloudConnectionsProps = {
	ghCloudSubscriptions: GhCloudSubscriptions;
};
const GitHubCloudConnections = ({
	ghCloudSubscriptions,
}: GitHubCloudConnectionsProps) => {
	return (
		<Box xcss={containerStyles}>
			<DynamicTableStateless
				head={head}
				rows={getGHSubscriptionsRows(ghCloudSubscriptions.successfulCloudConnections)}
				rowsPerPage={5}
				page={1}
			/>
		</Box>
	);
};

export default GitHubCloudConnections;

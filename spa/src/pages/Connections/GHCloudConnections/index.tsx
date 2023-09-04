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
	backgroundColor: "elevation.surface.raised",
	padding: "space.150",
	transition: "200ms",
	borderRadius: "border.radius.200",
	boxShadow: "elevation.shadow.raised",
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

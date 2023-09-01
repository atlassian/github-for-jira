import { DynamicTableStateless } from "@atlaskit/dynamic-table";
import {
	head,
	GhCloudSubscriptions,
	getGHSubscriptionsRows,
} from "./helper";
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
	isLoading: boolean;
	ghCloudSubscriptions: GhCloudSubscriptions;
};
const GitHubCloudConnections = ({
	isLoading,
	ghCloudSubscriptions,
}: GitHubCloudConnectionsProps) => {
	console.log("oooo",ghCloudSubscriptions);
	return (
		<Box xcss={containerStyles}>
			<DynamicTableStateless
				head={head}
				rows={getGHSubscriptionsRows(ghCloudSubscriptions.successfulCloudConnections)}
				rowsPerPage={5}
				page={1}
				isLoading={isLoading}
			/>
		</Box>
	);
};

export default GitHubCloudConnections;

import { DynamicTableStateless } from "@atlaskit/dynamic-table";

import {
	head,
	GhCloudSubscriptions,
	getGHCloudSubscriptionsRows,
} from "./helper";

type GitHubCloudConnectionsProps = {
	isLoading: boolean;
	ghCloudSubscriptions: GhCloudSubscriptions | null;
};
const GitHubCloudConnections = ({
	isLoading,
	ghCloudSubscriptions,
}: GitHubCloudConnectionsProps) => {
	return (
		<DynamicTableStateless
			head={head}
			rows={getGHCloudSubscriptionsRows(ghCloudSubscriptions)}
			rowsPerPage={5}
			page={1}
			isLoading={isLoading}
		/>
	);
};

export default GitHubCloudConnections;

import { DynamicTableStateless } from "@atlaskit/dynamic-table";

import { head, rows } from "./helper";

type GitHubCloudConnectionsProps = {
	isLoading: boolean;
};
const GitHubCloudConnections = ({ isLoading }: GitHubCloudConnectionsProps) => {
	return (
		<DynamicTableStateless
			head={head}
			rows={rows}
			rowsPerPage={5}
			page={1}
			isLoading={isLoading}
		/>
	);
};

export default GitHubCloudConnections;

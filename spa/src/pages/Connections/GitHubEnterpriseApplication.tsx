import { DynamicTableStateless } from "@atlaskit/dynamic-table";
import { useState } from "react";
import styled from "@emotion/styled";
import Heading from "@atlaskit/heading";
import ChevronRightIcon from "@atlaskit/icon/glyph/chevron-right";
import {
	GitHubEnterpriseApplication,
	head,
	getGHSubscriptionsRows,
} from "./helper";

const Wrapper = styled.div`
	display: flex;
	align-items: center;
    flex-direction: column;
`;

const ApplicationHeader = styled.div`
	display: flex;
	align-items: center;
    justify-content: flex-start;
    width: 100%;
`;

type GitHubEnterpriseApplicationProps = {
	application: GitHubEnterpriseApplication;
};

const GitHubEnterpriseApp = ({
	application,
}: GitHubEnterpriseApplicationProps) => {
	const [showAppContent, setShowAppContent] = useState<boolean>(false);
	return (
		<Wrapper>
			<ApplicationHeader
				onClick={() => {
					setShowAppContent((prevState) => !prevState);
				}}
			>
				<ChevronRightIcon label="" />
				<Heading level="h400">{application.gitHubAppName}</Heading>
			</ApplicationHeader>
			{showAppContent && (
				<DynamicTableStateless
					head={head}
					rows={getGHSubscriptionsRows(application.successfulConnections)}
					rowsPerPage={5}
					page={1}
				/>
			)}
		</Wrapper>
	);
};

export default GitHubEnterpriseApp;

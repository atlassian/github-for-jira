import { DynamicTableStateless } from "@atlaskit/dynamic-table";
import { useState } from "react";
import styled from "@emotion/styled";
import Heading from "@atlaskit/heading";
import ChevronRightIcon from "@atlaskit/icon/glyph/chevron-right";
import ChevronDownIcon from "@atlaskit/icon/glyph/chevron-down";
import { head, getGHSubscriptionsRows } from "../../../utils/dynamicTableHelper";
import { GitHubEnterpriseApplication } from "../../../rest-interfaces";

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
	margin-bottom: 20px;
`;

const ApplicationContent = styled.div`
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
				{showAppContent ? (
					<ChevronDownIcon label="" />
				) : (
					<ChevronRightIcon label="" />
				)}
				<Heading level="h400">{application.gitHubAppName}</Heading>
			</ApplicationHeader>
			{showAppContent && (
				<ApplicationContent>
					<DynamicTableStateless
						head={head}
						rows={getGHSubscriptionsRows(application.successfulConnections)}
						rowsPerPage={5}
						page={1}
					/>
				</ApplicationContent>
			)}
		</Wrapper>
	);
};

export default GitHubEnterpriseApp;

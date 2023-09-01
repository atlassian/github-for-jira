// import { DynamicTableStateless } from "@atlaskit/dynamic-table";
import { useState } from "react";
import styled from "@emotion/styled";
import Heading from "@atlaskit/heading";
import ChevronRightIcon from "@atlaskit/icon/glyph/chevron-right";
import { GitHubEnterpriseApplication } from "./helper";

const Wrapper = styled.div`
	display: flex;
	align-items: center;
`;

const ApplicationHeader = styled.div`
	display: flex;
	align-items: center;
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
					setShowAppContent(prevState => !prevState);
				}}
			>
				<ChevronRightIcon label="" />
				<Heading level="h400">{application.gitHubAppName}</Heading>
			</ApplicationHeader>
			{showAppContent && <h1>HI</h1>}
		</Wrapper>
	);
};

export default GitHubEnterpriseApp;

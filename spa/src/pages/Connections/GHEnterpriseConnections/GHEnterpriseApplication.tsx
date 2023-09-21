/** @jsxImportSource @emotion/react */
import { DynamicTableStateless } from "@atlaskit/dynamic-table";
import { useState } from "react";
import Heading from "@atlaskit/heading";
import ChevronRightIcon from "@atlaskit/icon/glyph/chevron-right";
import ChevronDownIcon from "@atlaskit/icon/glyph/chevron-down";
import { head, getGHSubscriptionsRows } from "../../../utils/dynamicTableHelper";
import { GitHubEnterpriseApplication } from "../../../rest-interfaces";
import { css } from "@emotion/react";

const wrapperStyle = css`
	display: flex;
	align-items: center;
	flex-direction: column;
`;

const applicationHeaderStyle = css`
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: flex-start;
	width: 100%;
	margin-bottom: 20px;
`;

const applicationContentStyle = css`
	width: 100%;
`;

type GitHubEnterpriseApplicationProps = {
	application: GitHubEnterpriseApplication;
};

const GitHubEnterpriseApp = ({
	application,
}: GitHubEnterpriseApplicationProps) => {
	const [showAppContent, setShowAppContent] = useState<boolean>(true);
	return (
		<div css={wrapperStyle}>
			<div
				css={applicationHeaderStyle}
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
			</div>
			{showAppContent && (
				<div css={applicationContentStyle}>
					<DynamicTableStateless
						head={head}
						rows={getGHSubscriptionsRows(application.successfulConnections)}
						rowsPerPage={5}
						page={1}
					/>
				</div>
			)}
		</div>
	);
};

export default GitHubEnterpriseApp;

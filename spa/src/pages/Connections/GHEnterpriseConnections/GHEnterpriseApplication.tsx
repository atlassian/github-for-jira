/** @jsxImportSource @emotion/react */
import { DynamicTableStateless } from "@atlaskit/dynamic-table";
import { useState } from "react";
import Heading from "@atlaskit/heading";
import ChevronRightIcon from "@atlaskit/icon/glyph/chevron-right";
import ChevronDownIcon from "@atlaskit/icon/glyph/chevron-down";
import {
	head,
	getGHSubscriptionsRows,
} from "../../../utils/dynamicTableHelper";
import {
	BackfillPageModalTypes,
	GitHubEnterpriseApplication,
	SuccessfulConnection,
} from "../../../rest-interfaces";
import { css } from "@emotion/react";

const connectNewAppLinkStyle = css`
	text-decoration: none;
`;

const wrapperStyle = css`
	display: flex;
	align-items: baseline;
	flex-direction: column;
`;

const noConnectionsHeaderStyle = css`
	padding-left: 25px;
	padding-bottom: 10px;
	padding-top: 10px;
`;

const noConnectionsBodyStyle = css`
	padding-left: 25px;
	padding-bottom: 10px;
	padding-top: 10px;
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
	setDataForModal: (
		dataForModal: SuccessfulConnection | undefined
	) => void;
	setSelectedModal: (selectedModal: BackfillPageModalTypes) => void;
	setIsModalOpened: (isModalOpen: boolean) => void;
};

function openChildWindow(url: string) {
	const child: Window | null = window.open(url);
	const interval = setInterval(function () {
		if (child?.closed) {
			clearInterval(interval);
			AP.navigator.reload();
		}
	}, 100);
	return child;
}

const GitHubEnterpriseApp = ({
	application,
	setIsModalOpened,
	setDataForModal,
	setSelectedModal,
}: GitHubEnterpriseApplicationProps) => {
	const [showAppContent, setShowAppContent] = useState<boolean>(true);
	const onConnectNewApp = () => {
		return AP.context.getToken((token: string) => {
			const child: Window | null = openChildWindow(
				`/session/github/${application.uuid}/configuration?ghRedirect=to`
			);
			if (child) {
				/* eslint-disable @typescript-eslint/no-explicit-any*/
				(child as any).window.jwt = token;
			}
		});
	};
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
				<>
					{application.successfulConnections.length > 0 ? (
						<div css={applicationContentStyle}>
							<DynamicTableStateless
								head={head}
								rows={getGHSubscriptionsRows(
									application.successfulConnections,
									{
										setIsModalOpened,
										setDataForModal,
										setSelectedModal,
									}
								)}
								rowsPerPage={5}
								page={1}
							/>
						</div>
					) : (
						<>
							<div css={noConnectionsHeaderStyle}>
								<Heading level="h200">Connected organizations</Heading>
							</div>
							<div css={noConnectionsBodyStyle}>
								No connected organizations.
								<a
									href="#"
									css={connectNewAppLinkStyle}
									onClick={onConnectNewApp}
								>
									{" "}
									Connect a GitHub organization.
								</a>
							</div>
						</>
					)}
				</>
			)}
		</div>
	);
};

export default GitHubEnterpriseApp;

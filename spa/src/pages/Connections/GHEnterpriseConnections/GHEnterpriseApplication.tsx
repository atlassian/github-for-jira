/** @jsxImportSource @emotion/react */
import { DynamicTableStateless } from "@atlaskit/dynamic-table";
import { useState } from "react";
import Heading from "@atlaskit/heading";
import { css } from "@emotion/react";
import {
	head,
	getGHSubscriptionsRows,
} from "../../../utils/dynamicTableHelper";
import {
	BackfillPageModalTypes,
	GitHubEnterpriseApplication,
	SuccessfulConnection,
} from "../../../rest-interfaces";
import GHEnterpriseAppHeader from "./GHEnterpriseAppHeader";
import { openChildWindow } from "../../../utils";

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

const applicationContentStyle = css`
	width: 100%;
`;

type GitHubEnterpriseApplicationProps = {
	application: GitHubEnterpriseApplication;
	setDataForModal: (
		dataForModal: SuccessfulConnection | GitHubEnterpriseApplication
	) => void;
	setSelectedModal: (selectedModal: BackfillPageModalTypes) => void;
	setIsModalOpened: (isModalOpen: boolean) => void;
	setIsLoading: (isLoading: boolean) => void;
};

const GitHubEnterpriseApp = ({
	application,
	setIsModalOpened,
	setDataForModal,
	setSelectedModal,
	setIsLoading,
}: GitHubEnterpriseApplicationProps) => {
	const [showAppContent, setShowAppContent] = useState<boolean>(true);
	const toggleShowAppContent = () =>
		setShowAppContent((prevState) => !prevState);
	const onConnectNewApp = () => {
		try{
			setIsLoading(true);
			return AP.context.getToken((token: string) => {
				const child: Window | null = openChildWindow(
					`/session/github/${application.uuid}/configuration?ghRedirect=to`
				);
				if (child) {
					/* eslint-disable @typescript-eslint/no-explicit-any*/
					(child as any).window.jwt = token;
				}
			});
		}
		catch(e){
			// TODO: handle this error in UI/Modal ?
			console.error("Could not get the token for GHE flow of connecting new App : ", e);
		}
		finally{
			setIsLoading(false);
		}
	};

	return (
		<div css={wrapperStyle}>
			<GHEnterpriseAppHeader
				application={application}
				setDataForModal={setDataForModal}
				setIsModalOpened={setIsModalOpened}
				setSelectedModal={setSelectedModal}
				showAppContent={showAppContent}
				toggleShowAppContent={toggleShowAppContent}
			/>
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

/** @jsxImportSource @emotion/react */
import DropdownMenu, {
	DropdownItem,
	DropdownItemGroup,
} from "@atlaskit/dropdown-menu";
import Button from "@atlaskit/button";
import { Flex, xcss } from "@atlaskit/primitives";
import MoreIcon from "@atlaskit/icon/glyph/more";
import Heading from "@atlaskit/heading";
import ChevronRightIcon from "@atlaskit/icon/glyph/chevron-right";
import ChevronDownIcon from "@atlaskit/icon/glyph/chevron-down";
import {
	BackfillPageModalTypes,
	GitHubEnterpriseApplication,
	SuccessfulConnection,
} from "../../../rest-interfaces";
import { css } from "@emotion/react";

const applicationHeaderStyle = css`
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: flex-start;
	width: 100%;
`;

const appHeaderContainerStyle = xcss({
	width: "100%",
	justifyContent: "space-between",
	marginBottom: "20px",
});

type GitHubEnterpriseApplicationProps = {
	application: GitHubEnterpriseApplication;
	setDataForModal: (dataForModal: SuccessfulConnection | GitHubEnterpriseApplication) => void;
	setSelectedModal: (selectedModal: BackfillPageModalTypes) => void;
	setIsModalOpened: (isModalOpen: boolean) => void;
	showAppContent: boolean;
	toggleShowAppContent: () => void;
};

const GitHubEnterpriseApp = ({
	application,
	setIsModalOpened,
	setDataForModal,
	setSelectedModal,
	showAppContent,
	toggleShowAppContent
}: GitHubEnterpriseApplicationProps) => {


	const onEditGitHubApp = () =>{
		const uuid = application.uuid;
		AP.navigator.go(
			"addonmodule",
			{
				moduleKey: "github-edit-app-page",
				customData: { uuid }
			}
		);
	};
	return (
			<Flex xcss={appHeaderContainerStyle}>
				<div
					css={applicationHeaderStyle}
					onClick={() => {
						toggleShowAppContent();
					}}
				>
					{showAppContent ? (
						<ChevronDownIcon label="" />
					) : (
						<ChevronRightIcon label="" />
					)}
					<Heading level="h400">{application.gitHubAppName}</Heading>
				</div>
				<div>
					<DropdownMenu
						trigger={({ triggerRef, ...props }) => (
							<Button
								{...props}
								appearance="subtle"
								iconBefore={<MoreIcon label="more" size="small" />}
								ref={triggerRef}
							/>
						)}
					>
						<DropdownItemGroup>
							<DropdownItem onClick={onEditGitHubApp}>Edit</DropdownItem>
							<DropdownItem onClick={()=>{
								setIsModalOpened(true);
								setDataForModal(application);
								setSelectedModal("DISCONNECT_SERVER_APP");
							}}>Disconnect</DropdownItem>
						</DropdownItemGroup>
					</DropdownMenu>
				</div>
			</Flex>
	);
};

export default GitHubEnterpriseApp;

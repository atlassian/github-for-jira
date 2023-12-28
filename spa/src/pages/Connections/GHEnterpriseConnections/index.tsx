/** @jsxImportSource @emotion/react */
import { token } from "@atlaskit/tokens";
import { first } from "lodash";
import { Box, xcss, Flex } from "@atlaskit/primitives";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import { css } from "@emotion/react";
import {
	BackfillPageModalTypes,
	GhEnterpriseServer,
	SuccessfulConnection,
	GitHubEnterpriseApplication
} from "../../../rest-interfaces";
import GHEApplication from "./GHEnterpriseApplication";

const enterpriserServerHeaderStyle = css`
	display: flex;
	align-items: center;
	flex-direction: row;
	width: 100%;
	justify-content: space-between;
`;

const enterpriserAppsHeaderStyle = css`
	padding-left: 25px;
	padding-bottom: 30px;
`;

const containerStyles = xcss({
	display: "flex",
	flexDirection: "column",
	justifyContent: "space-between",
	alignItems: "center",
	backgroundColor: "elevation.surface.hovered",
	padding: "space.150",
	transition: "200ms",
	borderRadius: "border.radius.200",
	boxShadow: "elevation.shadow.raised",
});

const containerHeaderStyle = xcss({
	width: "100%",
	justifyContent: "space-between",
});

const whiteBoxStyle = xcss({
	display: "flex",
	flexDirection: "column",
	padding: "space.200",
	transition: "200ms",
	borderRadius: "border.radius.100",
	marginTop: `${token("space.200")}`,
	marginBottom: `${token("space.200")}`,
	boxShadow: "elevation.shadow.raised",
	backgroundColor: "elevation.surface.raised",
	width: "100%",
});
type GitHubEnterpriseConnectionsProps = {
	ghEnterpriseServers: GhEnterpriseServer[];
	setDataForModal: (
		dataForModal: SuccessfulConnection | GitHubEnterpriseApplication | undefined
	) => void;
	setSelectedModal: (selectedModal: BackfillPageModalTypes) => void;
	setIsModalOpened: (isModalOpen: boolean) => void;
};
const GitHubEnterpriseConnections = ({
	ghEnterpriseServers,
	setIsModalOpened,
	setDataForModal,
	setSelectedModal,
}: GitHubEnterpriseConnectionsProps) => {
	return (
		<>
			{ghEnterpriseServers.map((connection) => {
				return (
					<>
						<Box xcss={containerStyles}>
							<Flex xcss={containerHeaderStyle}>
								<div css={enterpriserServerHeaderStyle}>
									<Heading level="h400">{connection.gitHubBaseUrl}</Heading>
								</div>
								<Button
									onClick={() => {
										setIsModalOpened(true);
										setDataForModal(first(connection.applications));
										setSelectedModal("DISCONNECT_SERVER");
									}}
								>
									Disconnect server
								</Button>
							</Flex>

							<Box xcss={whiteBoxStyle}>
								<div css={enterpriserAppsHeaderStyle}>
									<Heading level="h100">APPLICATIONS</Heading>
								</div>
								{connection.applications.map((application) => (
									<GHEApplication
										application={application}
										setIsModalOpened={setIsModalOpened}
										setDataForModal={setDataForModal}
										setSelectedModal={setSelectedModal}
									/>
								))}
							</Box>
						</Box>
					</>
				);
			})}
		</>
	);
};

export default GitHubEnterpriseConnections;

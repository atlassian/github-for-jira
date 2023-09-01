import { token } from "@atlaskit/tokens";
import { Box, xcss } from "@atlaskit/primitives";
import Button from "@atlaskit/button";
import styled from "@emotion/styled";
import Heading from "@atlaskit/heading";
import { GhEnterpriseServer } from "../../rest-interfaces";
import GitHubEnterpriseApplication from "./GitHubEnterpriseApplication";

const EnterpriserServerHeader = styled.div`
	display: flex;
	align-items: center;
	flex-direction: row;
	width: 100%;
	justify-content: space-between;
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
	width: "100%"
});
type GitHubEnterpriseConnectionsProps = {
	ghEnterpriseServers: GhEnterpriseServer[];
};
const GitHubEnterpriseConnections = ({
	ghEnterpriseServers,
}: GitHubEnterpriseConnectionsProps) => {
	return ghEnterpriseServers.map((connection) => {
		return (
			<Box xcss={containerStyles}>
				<EnterpriserServerHeader>
					<Heading level="h600">{connection.gitHubBaseUrl}</Heading>
					<Button>Disconnect server</Button>
				</EnterpriserServerHeader>
				<Box xcss={whiteBoxStyle}>
					{connection.applications.map((application) => (<GitHubEnterpriseApplication application={application}/>))}
				</Box>
			</Box>
		);
	});
};

export default GitHubEnterpriseConnections;

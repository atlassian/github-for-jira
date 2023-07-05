import { token } from "@atlaskit/tokens";
import styled from "@emotion/styled";

const HeaderWrapper = styled.div`
	text-align: center;
`;

const LogoContainer = styled.div`
	display: inline-flex;
	align-items: center;
`;

const Logo = styled.img`
	height: ${token("space.800", "64px")};
	padding: ${token("space.100", "8px")};
`;

const SyncLogo = styled.img`
	height: ${token("space.500", "40px")};
	padding: ${token("space.100", "8px")};
`;
const Title = styled.h2`
	margin: ${token("space.400", "32px")} ${token("space.0", "0px")} ${token("space.0", "0px")};
`;


const SyncHeader = () => (
	<HeaderWrapper>
		<LogoContainer>
			<Logo className="logo" src="public/assets/jira-logo.svg" alt=""/>
			<SyncLogo className="sync-logo" src="public/assets/sync.svg" alt=""/>
			<Logo className="logo" src="public/assets/github-logo.svg" alt=""/>
		</LogoContainer>
		<Title>Connect Github to Jira</Title>
	</HeaderWrapper>
);

export default SyncHeader;

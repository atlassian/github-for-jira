import styled from "@emotion/styled";

const HeaderWrapper = styled.div`
	text-align: center;
`;

const LogoContainer = styled.div`
	display: inline-flex;
	align-items: center;
`;

const Logo = styled.img`
	height: 64px;
	padding: 8px;
`;

const SyncLogo = styled.img`
	height: 40px;
	padding: 8px;
`;
const Title = styled.h2`
	margin: 36px 0 0;
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

import { token, useThemeObserver } from "@atlaskit/tokens";
import styled from "@emotion/styled";

const HeaderWrapper = styled.div`
	text-align: center;
`;

const LogoContainer = styled.div`
	display: inline-flex;
	align-items: center;
`;

const Logo = styled.img`
	height: ${token("space.800")};
	padding: ${token("space.100")};
`;

const SyncLogo = styled.img`
	height: ${token("space.500")};
	padding: ${token("space.100")};
`;
const Title = styled.h2`
	margin: ${token("space.400")} ${token("space.0")} ${token("space.300")};
`;

const SyncHeader = () => {
	const { colorMode } = useThemeObserver();

	return (
		<HeaderWrapper>
			<LogoContainer>
				<Logo className="logo" src="/public/assets/jira-logo.svg" alt=""/>
				<SyncLogo className="sync-logo" src="/public/assets/sync.svg" alt=""/>
				<Logo
					className="logo"
					src={colorMode === "dark" ? "/public/assets/github-logo-dark-theme.svg" : "/public/assets/github-logo.svg"}
					alt=""
				/>
			</LogoContainer>
			<Title>Connect Github to Jira</Title>
		</HeaderWrapper>
	);
};

export default SyncHeader;

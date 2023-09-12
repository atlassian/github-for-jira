import { token, useThemeObserver } from "@atlaskit/tokens";
import styled from "@emotion/styled";
import { css } from "@emotion/react";

const headerWrapperStyle = css`
	text-align: center;
`;

const logoContainerStyle = css`
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
		<div css={headerWrapperStyle}>
			<div css={logoContainerStyle}>
				<Logo className="logo" src="/public/assets/jira-logo.svg" alt=""/>
				<SyncLogo className="sync-logo" src="/public/assets/sync.svg" alt=""/>
				<Logo
					className="logo"
					src={colorMode === "dark" ? "/public/assets/github-logo-dark-theme.svg" : "/public/assets/github-logo.svg"}
					alt=""
				/>
			</div>
			<Title>Connect Github to Jira</Title>
		</div>
	);
};

export default SyncHeader;

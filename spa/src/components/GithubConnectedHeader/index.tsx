/** @jsxImportSource @emotion/react */
import { token, useThemeObserver } from "@atlaskit/tokens";
import { css } from "@emotion/react";

const headerWrapperStyle = css`
	text-align: center;
`;
const logoContainerStyle = css`
	display: inline-flex;
	align-items: center;
`;
const logoImgStyle = css`
	height: 96px;
`;
const titleStyle = css`
	margin: ${token("space.400")} ${token("space.0")} ${token("space.300")};
`;

const GithubConnectedHeader = () => {
	const { colorMode } = useThemeObserver();

	return (
		<div css={headerWrapperStyle}>
			<div css={logoContainerStyle}>
				<img
					css={logoImgStyle}
					src={
						colorMode === "dark"
							? "/public/assets/jira-github-connected-dark-theme.svg"
							: "/public/assets/jira-github-connected.svg"
					}
					alt=""
				/>
			</div>
			<h2 css={titleStyle}>GitHub is now connected</h2>
		</div>
	);
};

export default GithubConnectedHeader;

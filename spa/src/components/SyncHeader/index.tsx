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
	height: ${token("space.800")};
	padding: ${token("space.100")};
`;

const syncLogoImg = css`
	height: ${token("space.500")};
	padding: ${token("space.100")};
`;
const titleStyle = css`
	margin: ${token("space.400")} ${token("space.0")} ${token("space.300")};
`;

const SyncHeader = () => {
	const { colorMode } = useThemeObserver();

	return (
		<div css={headerWrapperStyle}>
			<div css={logoContainerStyle}>
				<img
					css={logoImgStyle}
					className="logo"
					src="/public/assets/jira-logo.svg"
					alt=""
				/>
				<img
					css={syncLogoImg}
					className="sync-logo"
					src="/public/assets/sync.svg"
					alt=""
				/>
				<img
					css={logoImgStyle}
					className="logo"
					src={
						colorMode === "dark"
							? "/public/assets/github-logo-dark-theme.svg"
							: "/public/assets/github-logo.svg"
					}
					alt=""
				/>
			</div>
			<h2 css={titleStyle}>Connect Github to Jira</h2>
		</div>
	);
};

export default SyncHeader;

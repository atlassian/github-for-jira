/** @jsxImportSource @emotion/react */
import { ReactNode } from "react";
import { css } from "@emotion/react";
import Button from "@atlaskit/button";
import CrossIcon from "@atlaskit/icon/glyph/cross";
import analyticsClient from "../analytics";

const navHeight = 56;
const wrapperStyle = css`
	padding: 20px 40px 0px 40px;
`;
const getWrapperCenterStyle = (width: string | undefined) => css`
	margin: 0 auto;
	max-width: ${width ? width: "580px"};
	height: calc(100vh - ${navHeight * 2}px);
	display: flex;
	flex-direction: column;
	justify-content: center;
`;

export const Wrapper = (attr: { hideClosedBtn?: boolean, children?: ReactNode | undefined, width?:string }) => {
	const navigateToHomePage = () => {
		analyticsClient.sendUIEvent({ actionSubject: "dropExperienceViaBackButton", action: "clicked" });
		AP.getLocation((location: string) => {
			const locationUrl = new URL(location);
			AP.navigator.go( "site", { absoluteUrl: `${locationUrl.origin}/jira/marketplace/discover/app/com.github.integration.production` });
		});
	};
	const wrapperCenterStyle = getWrapperCenterStyle(attr.width || undefined);

	return (
		<div css={wrapperStyle}>
			{
				!attr.hideClosedBtn && <Button
					style={{ float: "right" }}
					iconBefore={<CrossIcon label="Close" size="medium" />}
					appearance="subtle"
					onClick={navigateToHomePage}
				/>
			}
			<div css={wrapperCenterStyle}>{attr.children}</div>
		</div>
	);
};

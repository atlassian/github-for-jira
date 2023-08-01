import { ReactNode } from "react";
import styled from "@emotion/styled";
import Button from "@atlaskit/button";
import HomeIcon from "@atlaskit/icon/glyph/home";
import analyticsClient from "../analytics";

const navHeight = 56;
const WrapperOutterStyled = styled.div`
	padding: 20px 40px 0px 40px;
`;
const WrapperCenterStyled = styled.div`
	margin: 0 auto;
	max-width: 580px;
	height: calc(100vh - ${navHeight * 2}px);
	display: flex;
	flex-direction: column;
	justify-content: center;
`;

const navigateToHomePage = () => {
	analyticsClient.sendUIEvent({ actionSubject: "dropExperienceViaBackButton", action: "clicked" });
	AP.navigator.go( "addonmodule", { moduleKey: "gh-addon-admin" });
};

export const Wrapper = (attr: {
	children?: ReactNode | undefined;
}) => {
	return <WrapperOutterStyled>
			<Button
				iconBefore={<HomeIcon label="Back to home" size="medium" />}
				appearance="subtle"
				onClick={ navigateToHomePage }
			>
		</Button>
		<WrapperCenterStyled>
			{ attr.children }
		</WrapperCenterStyled>
	</WrapperOutterStyled>;
};

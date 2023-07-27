import { useNavigate } from "react-router-dom";
import Button from "@atlaskit/button";
import ArrowRightIcon from "@atlaskit/icon/glyph/arrow-right";
import UserAvatarCircleIcon from "@atlaskit/icon/glyph/user-avatar-circle";
import UnlockFilledIcon from "@atlaskit/icon/glyph/unlock-filled";
import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";
import Tooltip, { TooltipPrimitive } from "@atlaskit/tooltip";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import analyticsClient, { useEffectScreenEvent } from "../../analytics";

const BeforeText = styled.div`
	color: ${token("color.text.subtle")};
	margin: 0 0 ${token("space.300")};
	text-align: center;
`;
const ListContainer = styled.div`
	background: ${token("color.background.input.hovered")};
	max-width: 368px;
	padding: ${token("space.250")};
	border-radius: ${token("space.050")};
	margin: 0 auto;
`;
const ListItem = styled.div`
	display: flex;
	margin-bottom: ${token("space.075")};
`;
const Logo = styled.div`
	margin: ${token("space.025")} ${token("space.075")} 0 0;
`;
const ButtonContainer = styled.div`
	text-align: center;
	margin: ${token("space.300")} 0 0;
`;
const InlineDialogLink = styled.a`
	cursor: pointer;
`;
const InlineDialogDiv = styled.div`
	padding: ${token("space.200")} 0 0 ${token("space.150")};
`;
const InlineDialogImgContainer = styled.div`
	height: 180px;
	text-align: center;
	padding: ${token("space.200")} 0;
`;
const InlineDialog = styled(TooltipPrimitive)`
	background: white;
	border-radius: ${token("space.050")};
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	box-sizing: content-box;
	padding: ${token("space.100")} ${token("space.150")};
	position: absolute;
	top: -22px;
`;

const GITHUB_CLOUD_ORG_SETTINGS_URL = "https://github.com/settings/organizations";

const InlineDialogContent = () => (
	<>
		<InlineDialogDiv>To check your GitHub permissions:</InlineDialogDiv>
		<ol>
			<li>Go to <a href={GITHUB_CLOUD_ORG_SETTINGS_URL} target="_blank">manage organizations</a></li>
			<li>Your permission level will be next to your organization name.</li>
		</ol>
		<InlineDialogImgContainer>
			<img src="/public/assets/github-skeleton.svg" alt=""/>
		</InlineDialogImgContainer>
	</>
);

const StartConnection = () => {
	const navigate = useNavigate();

	useEffectScreenEvent("StartConnectionEntryScreen");

	return (
		<Wrapper>
			<SyncHeader/>
			<BeforeText>Before you start, you'll need:</BeforeText>
			<ListContainer>
				<ListItem>
					<Logo>
						<UserAvatarCircleIcon label="github-account" size="small"/>
					</Logo>
					<span>A GitHub account</span>
				</ListItem>
				<ListItem>
					<Logo>
						<UnlockFilledIcon label="owner-permission" size="small"/>
					</Logo>
					<div>
						<span>Owner permission for a GitHub organization</span><br/>
						<Tooltip
							component={InlineDialog}
							position="right-end"
							content={InlineDialogContent}
						>
							{(props) => <InlineDialogLink {...props}>Learn how to check Github permissions</InlineDialogLink>}
						</Tooltip>
					</div>
				</ListItem>
			</ListContainer>
			<ButtonContainer>
				<Button
					iconAfter={<ArrowRightIcon label="continue" size="medium"/>}
					appearance="primary"
					onClick={() => {
						analyticsClient.sendUIEvent({ actionSubject: "startToConnect", action: "clicked" });
						navigate("steps");
					}}
				>
					Continue
				</Button>
			</ButtonContainer>
		</Wrapper>
	);
};

export default StartConnection;

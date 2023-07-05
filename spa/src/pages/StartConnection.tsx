import { useNavigate } from "react-router-dom";
import Button from "@atlaskit/button";
import ArrowRightIcon from "@atlaskit/icon/glyph/arrow-right";
import PersonCircleIcon from "@atlaskit/icon/glyph/person-circle";
import UnlockIcon from "@atlaskit/icon/glyph/unlock";
import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";
import Tooltip, { TooltipPrimitive } from "@atlaskit/tooltip";
import SyncHeader from "../components/SyncHeader";
import { Wrapper } from "../styles/Wrapper";

const BeforeText = styled.div`
	color: ${token("color.text.subtle", "#44546F")};
	margin: ${token("space.300", "24px")} ${token("space.0", "0px")};
	text-align: center;
`;
const ListContainer = styled.div`
	background: ${token("color.background.input.hovered", "#F7F8F9")};
	max-width: 368px;
	padding: ${token("space.250", "20px")};
	border-radius: ${token("space.050", "4px")};
	margin: 0 auto;
`;
const ListItem = styled.div`
	display: flex;
	margin-bottom: ${token("space.075", "6px")};
`;
const Logo = styled.div`
	margin: ${token("space.025", "2px")} ${token("space.075", "6px")} 0 0;
`;
const ButtonContainer = styled.div`
	text-align: center;
	margin: ${token("space.300", "24px")} 0 0;
`;
const InlineDialogLink = styled.a`
	cursor: pointer;
`;
const InlineDialogDiv = styled.div`
	padding-left: ${token("space.150", "12px")};
`;
const InlineDialogImgContainer = styled.div`
	height: 180px;
	text-align: center;
	padding-bottom: ${token("space.150", "12px")};
`;
const InlineDialog = styled(TooltipPrimitive)`
	background: white;
	border-radius: ${token("space.050", "4px")};
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	box-sizing: content-box;
	padding: ${token("space.100", "8px")} ${token("space.150", "12px")};
	position: absolute;
	top: -22px;
`;

const InlineDialogContent = () => (
	<>
		<InlineDialogDiv>To check your GitHub permissions:</InlineDialogDiv>
		<ol>
			{/* TODO: Add the URL for this link*/}
			<li>Go to <a href="">manage organizations</a></li>
			<li>Your permission level will be next to your organization name.</li>
		</ol>
		<InlineDialogImgContainer>
			<img src="public/assets/github-skeleton.svg" alt=""/>
		</InlineDialogImgContainer>
	</>
);

const StartConnection = () => {
	const navigate = useNavigate();
	return (
		<Wrapper>
			<SyncHeader/>
			<BeforeText>Before you start you'll need:</BeforeText>
			<ListContainer>
				<ListItem>
					<Logo>
						<PersonCircleIcon label="github-account" size="small"/>
					</Logo>
					<span>A GitHub account</span>
				</ListItem>
				<ListItem>
					<Logo>
						<UnlockIcon label="owner-permission" size="small"/>
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
					onClick={() => navigate("steps")}
				>
					Continue
				</Button>
			</ButtonContainer>
		</Wrapper>
	);
};

export default StartConnection;

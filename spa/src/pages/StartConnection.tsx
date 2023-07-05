import { useNavigate } from "react-router-dom";
import Button from "@atlaskit/button";
import ArrowRightIcon from "@atlaskit/icon/glyph/arrow-right";
import PersonCircleIcon from "@atlaskit/icon/glyph/person-circle";
import UnlockIcon from "@atlaskit/icon/glyph/unlock";
import styled from "@emotion/styled";
import SyncHeader from "../components/SyncHeader";
import { Wrapper } from "../styles/Wrapper";

const BeforeText = styled.div`
	color: #44546F;
	margin: 24px 0;
	text-align: center;
`;
const ListContainer = styled.div`
	background: #F7F8F9;
	max-width: 368px;
	padding: 16px;
	border-radius: 3px;
	margin: 0 auto;
`;
const ListItem = styled.div`
	display: flex;
	margin-bottom: 6px;
`;
const Logo = styled.div`
	margin: 2px 6px 0 0;
`;
const ButtonContainer = styled.div`
	text-align: center;
	margin: 24px 0 0;
`;


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
						<a href="">Learn how to check Github permissions</a>
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

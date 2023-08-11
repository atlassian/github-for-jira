import LoggedinInfo from "../../common/LoggedinInfo";
import { Wrapper } from "../../common/Wrapper";
import Step from "../../components/Step";
import SyncHeader from "../../components/SyncHeader";
import OAuthManager from "../../services/oauth-manager";
import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";
import Button from "@atlaskit/button";
import { useNavigate } from "react-router-dom";

const Paragraph = styled.div`
	color: ${token("color.text.subtle")};
	margin-bottom: ${token("space.100")};
`;

const InstallationRequested = () => {
	const navigate = useNavigate();
	const username = OAuthManager.getUserDetails().username || "";

	const navigateBackToSteps = () => navigate("/spa/steps");

	return (
		<Wrapper>
			<SyncHeader />
			<Step title="Request sent">
				<>
					<Paragraph>
						Once the owner of this organization has installed Jira, you (or <br />
						another Jira admin) can come back here and finish the set up.
					</Paragraph>
					<Button
						style={{ paddingLeft: 0 }}
						appearance="link"
						onClick={navigateBackToSteps}
					>
						Add another organization
					</Button>
				</>
			</Step>
			<LoggedinInfo
				username={username}
				logout={navigateBackToSteps}
			/>
		</Wrapper>
	);
};

export default InstallationRequested;

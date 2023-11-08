/** @jsxImportSource @emotion/react */

import LoggedinInfo from "../../common/LoggedinInfo";
import { Wrapper } from "../../common/Wrapper";
import Step from "../../components/Step";
import SyncHeader from "../../components/SyncHeader";
import OAuthManager from "../../services/oauth-manager";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import Button from "@atlaskit/button";
import { useNavigate } from "react-router-dom";
import { useEffectScreenEvent } from "../../analytics";

const paragraphStyle = css`
	color: ${token("color.text.subtle")};
	margin-bottom: ${token("space.100")};
`;

const InstallationRequested = () => {
	const navigate = useNavigate();
	const username = OAuthManager.getUserDetails().username || "";

	useEffectScreenEvent("InstallationRequested");

	const navigateBackToSteps = () => navigate("/spa/steps");

	return (
		<Wrapper>
			<SyncHeader />
			<Step title="Request sent">
				<>
					<div css={paragraphStyle}>
						Once the owner of this organization has installed Jira, you (or <br />
						another Jira admin) can come back here and finish the set up.
					</div>
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
				onPopupBlocked={() => { /* do nothing as ui flow will redirect to entry page anyway */ }}
			/>
		</Wrapper>
	);
};

export default InstallationRequested;

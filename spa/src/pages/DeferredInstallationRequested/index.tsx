/** @jsxImportSource @emotion/react */
import { useSearchParams, useNavigate } from "react-router-dom";
import LoggedinInfo from "../../common/LoggedinInfo";
import { Wrapper } from "../../common/Wrapper";
import Step from "../../components/Step";
import SyncHeader from "../../components/SyncHeader";
import OAuthManager from "../../services/oauth-manager";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import Button from "@atlaskit/button";

const paragraphStyle = css`
	color: ${token("color.text.subtle")};
	margin-bottom: ${token("space.100")};
`;

const DeferredInstallationRequested = () => {
	const [searchParams] = useSearchParams();
	const githubInstallationId = searchParams.get("gitHubInstallationId");
	const navigate = useNavigate();
	const username = OAuthManager.getUserDetails().username || "";


	const signInAndInstall = () => {
		console.log("Sign in and install");
	};
	const navigateBackToSteps = () => navigate("/spa/steps");

	return (
		<Wrapper>
			<SyncHeader />
			{
				githubInstallationId && <>
					<Step title="Request sent">
						<>
							<div css={paragraphStyle}>
								Repositories in <b>ORG NAME</b> will be available<br />
								to all projects in <b>JIRAHOST</b>.
							</div>
							<Button
								style={{ paddingLeft: 0 }}
								appearance="link"
								onClick={signInAndInstall}
							>
								Sign in & Install
							</Button>
						</>
					</Step>
					{
						Boolean(username) && <LoggedinInfo
							username={username}
							logout={navigateBackToSteps}
						/>
					}
				</>
			}
		</Wrapper>
	);
};

export default DeferredInstallationRequested;

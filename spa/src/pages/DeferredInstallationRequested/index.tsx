/** @jsxImportSource @emotion/react */
import { useSearchParams, useNavigate } from "react-router-dom";
import LoggedinInfo from "../../common/LoggedinInfo";
import { Wrapper } from "../../common/Wrapper";
import Step from "../../components/Step";
import SyncHeader from "../../components/SyncHeader";
import OAuthManager from "../../services/oauth-manager";
import AppManager from "../../services/app-manager";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import Button from "@atlaskit/button";
import { useEffect, useState } from "react";
import { AxiosError } from "axios";

const paragraphStyle = css`
	color: ${token("color.text.subtle")};
	margin-bottom: ${token("space.100")};
`;

const DeferredInstallationRequested = () => {
	const [searchParams] = useSearchParams();
	const githubInstallationId = searchParams.get("gitHubInstallationId");
	const navigate = useNavigate();
	const username = OAuthManager.getUserDetails().username || "";

	const [loggedInUser, setLoggedInUser] = useState<string | undefined>(username);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoggedIn, setIsLoggedIn] = useState(false);


	useEffect(() => {
		const authenticate = async () => {
			setIsLoading(true);
			try {
				await OAuthManager.authenticateInGitHub(() => {
					setIsLoading(false);
					console.log("Successfully authenticated", username);
				});
			} catch (e) {
				console.log("check error", e);
			} finally {
				setIsLoading(false);
			}
		};
		authenticate();
	}, []);

	useEffect(() => {
		const handler = async (event: MessageEvent) => {
			if (event.data?.type === "oauth-callback" && event.data?.code) {
				const response: boolean | AxiosError = await OAuthManager.finishOAuthFlow(event.data?.code, event.data?.state);
				setIsLoading(false);
				if (response instanceof AxiosError) {
					console.log("Error", response);
					return;
				}
				setIsLoggedIn(true);
			}
		};
		window.addEventListener("message", handler);
		return () => {
			window.removeEventListener("message", handler);
		};
	}, []);

	useEffect(() => {
		const recheckValidity = async () => {
			const status: boolean | AxiosError = await OAuthManager.checkValidity();
			if (status instanceof AxiosError) {
				console.log("Error", status);
				return;
			}
			setLoggedInUser(OAuthManager.getUserDetails().username);
			setIsLoading(false);
		};
		isLoggedIn && recheckValidity();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isLoggedIn ]);

	const signInAndInstall = async () => {
		console.log("Sign in and install");
		if (githubInstallationId) {
			const connected: boolean | AxiosError = await AppManager.connectOrg(parseInt(githubInstallationId));
			if (connected instanceof AxiosError) {
				console.log("Error", connected);
			} else {
				navigate("/spa/connected");
			}
		}
	};
	const navigateBackToSteps = () => navigate("/spa/steps");

	return (
		<Wrapper>
			<SyncHeader />
			{
				isLoading ? <div>
					Loading
				</div> : <>
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
								loggedInUser &&
									<LoggedinInfo
										username={loggedInUser}
										logout={navigateBackToSteps}
									/>
							}
						</>
					}
				</>
			}
		</Wrapper>
	);
};

export default DeferredInstallationRequested;

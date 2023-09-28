/** @jsxImportSource @emotion/react */
import { useSearchParams, useNavigate } from "react-router-dom";
import LoggedinInfo from "../../common/LoggedinInfo";
import { Wrapper } from "../../common/Wrapper";
import Step from "../../components/Step";
import SyncHeader from "../../components/SyncHeader";
import OAuthManager from "../../services/oauth-manager";
import AppManager from "../../services/app-manager";
import { css } from "@emotion/react";
import SkeletonForLoading from "../ConfigSteps/SkeletonForLoading";
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
	const [isAdmin, setIsAdmin] = useState(false);

	// Authenticate if no token/username is set
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
		if (!username) {
			authenticate();
		}
	}, [username]);

	// Finish the OAuth dance if authenticated
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

	// Set the token/username after authentication
	useEffect(() => {
		// Check if the current Github user is admin or not
		const checkOrgOwnership = async () => {
			if (githubInstallationId) {
				const status: boolean | AxiosError = await OAuthManager.checkGithubOwnership(parseInt(githubInstallationId));
				if (status instanceof AxiosError) {
					console.log("Error", status);
					setIsAdmin(false);
				} else {
					setIsAdmin(true);
				}
			}
		};

		// Check token validity
		const recheckValidity = async () => {
			setIsLoading(true);
			const status: boolean | AxiosError = await OAuthManager.checkValidity();
			if (status instanceof AxiosError) {
				console.log("Error", status);
				return;
			}
			setLoggedInUser(OAuthManager.getUserDetails().username);
			await checkOrgOwnership();
			setIsLoading(false);
		};

		isLoggedIn && recheckValidity();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isLoggedIn ]);

	const connectOrg = async () => {
		if (githubInstallationId) {
			const connected: boolean | AxiosError = await AppManager.connectOrg(parseInt(githubInstallationId));
			if (connected instanceof AxiosError) {
				console.log("Error", status);
			} else {
				navigate("connected");
			}
		}
	};
	const navigateBackToSteps = () => navigate("/spa/steps");

	return (
		<Wrapper>
			<SyncHeader />
			{
				isLoading ? <SkeletonForLoading /> : <>
					{
						isAdmin ? <>
							<Step title="Request sent">
								<>
									<div css={paragraphStyle}>
										Repositories in <b>ORG NAME</b> will be available<br />
										to all projects in <b>JIRAHOST</b>.
									</div>
									<Button
										style={{ paddingLeft: 0 }}
										appearance="link"
										onClick={connectOrg}
									>
										Sign in & Install
									</Button>
								</>
							</Step>
						</> : <>
							<Step title="You don't have owner permission">
								<p>
									Can’t connect ORG to JIRAHOST as you’re not the organisation’s owner.<br />
									An organization owner needs to complete connection,
									send them instructions on how to do this.
								</p>
							</Step>
						</>
					}
					{
						loggedInUser &&
						<LoggedinInfo
							username={loggedInUser}
							logout={navigateBackToSteps}
						/>
					}
				</>
			}
		</Wrapper>
	);
};

export default DeferredInstallationRequested;

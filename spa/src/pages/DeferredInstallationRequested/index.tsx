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
import { CheckOrgOwnershipResponse } from "../../rest-interfaces";
import { ErrorObjType, modifyError } from "../../utils/modifyError";
import ErrorUI from "../../components/Error";

const paragraphStyle = css`
	color: ${token("color.text.subtle")};
	margin-bottom: ${token("space.100")};
`;

type UserRole = "admin" | "nonAdmin" | "notSet";

const DeferredInstallationRequested = () => {
	const [searchParams] = useSearchParams();
	const githubInstallationId = searchParams.get("gitHubInstallationId");
	const navigate = useNavigate();
	const username = OAuthManager.getUserDetails().username || "";

	const [hostUrl, setHostUrl] = useState("");
	const [loggedInUser, setLoggedInUser] = useState<string | undefined>(username);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [userRole, setUserRole] = useState<UserRole>("notSet");
	const [orgName, setOrgName] = useState("");
	const [error, setError] = useState<ErrorObjType | undefined>(undefined);

	const getJiraHostUrls = () => {
		AP.getLocation((location: string) => {
			const locationUrl = new URL(location);
			setHostUrl( locationUrl.origin);
		});
	};

	// Authenticate if no token/username is set
	useEffect(() => {
		getJiraHostUrls();
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
				const response: CheckOrgOwnershipResponse | AxiosError = await OAuthManager.checkGithubOwnership(parseInt(githubInstallationId));
				if (response instanceof AxiosError) {
					setUserRole("nonAdmin");
				} else {
					setUserRole(response.isAdmin ? "admin" : "nonAdmin");
					setOrgName(response.orgName);
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
			setIsLoading(true);
			const connected: boolean | AxiosError = await AppManager.connectOrg(parseInt(githubInstallationId ));
			if (connected instanceof AxiosError) {
				setError(modifyError(connected, {}, { onClearGitHubToken: () => {}, onRelogin: () => {} }));
			} else {
				navigate("connected");
			}
			setIsLoading(true);
		}
	};
	const navigateBackToSteps = () => navigate("/spa/steps");

	return (
		<Wrapper>
			<SyncHeader />
			{
				error && <ErrorUI type={error.type} message={error.message} />
			}
			{
				isLoading ? <SkeletonForLoading /> : <>
					{
						userRole === "notSet" && <SkeletonForLoading />
					}
					{
						userRole === "nonAdmin" && 	<Step title="You don't have owner permission">
							<p>
								Can’t connect <b>{orgName}</b> to <b>{hostUrl}</b> as you’re not the organisation’s owner.<br />
								An organization owner needs to complete connection,
								send them instructions on how to do this.
							</p>
						</Step>
					}
					{
						userRole === "admin" && <Step title="Request sent">
							<>
								<div css={paragraphStyle}>
									Repositories in <b>{orgName}</b> will be available<br />
									to all projects in <b>{hostUrl}</b>.
								</div>
								<Button
									style={{ paddingLeft: 0 }}
									appearance="link"
									onClick={connectOrg}
								>
									Install
								</Button>
							</>
						</Step>
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

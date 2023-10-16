/** @jsxImportSource @emotion/react */
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import InfoIcon from "@atlaskit/icon/glyph/info";
import LoggedinInfo from "../../common/LoggedinInfo";
import { Wrapper } from "../../common/Wrapper";
import Step from "../../components/Step";
import SyncHeader from "../../components/SyncHeader";
import OAuthManager from "../../services/oauth-manager";
import AppManager from "../../services/app-manager";
import { css } from "@emotion/react";
import { Box, xcss } from "@atlaskit/primitives";
import SkeletonForLoading from "../ConfigSteps/SkeletonForLoading";
import { token } from "@atlaskit/tokens";
import Button from "@atlaskit/button";
import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { CheckOrgOwnershipResponse } from "../../rest-interfaces";
import { ErrorObjType, modifyError } from "../../utils/modifyError";
import ErrorUI from "../../components/Error";
import analyticsClient from "../../analytics";
import { popup } from "../../utils";

const boxStyles = xcss({
	borderBlockWidth: token("space.500"),
	borderStyle: "solid",
	borderColor: "color.border",
	borderRadius: "border.radius.050",
	borderWidth: "border.width",
	marginTop: token("space.200"),
	marginBottom: token("space.200"),
	display: "flex",
	alignItems: "center",
});
const paragraphStyle = css`
	color: ${token("color.text.subtle")};
	margin: ${token("space.0")};
`;
const noAdminDivStyle = css`
	margin-top: ${token("space.200")};
`;
const infoParaStyle = css`
	padding-left: 16px;
`;
const linkStyle = css`
	cursor: pointer;
	padding-left: 0;
	padding-right: 0;
`;

type UserRole = "admin" | "nonAdmin" | "notSet";

const DeferredInstallationRequested = () => {
	const laction = useLocation();
	const [searchParams] = useSearchParams();
	const githubInstallationId = searchParams.get("gitHubInstallationId");
	const gitHubOrgName = searchParams.get("gitHubOrgName");
	console.log(">>>",laction);
	const navigate = useNavigate();
	const username = OAuthManager.getUserDetails().username || "";

	const [hostUrl, setHostUrl] = useState("");
	const [loggedInUser, setLoggedInUser] = useState<string | undefined>(username);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [userRole, setUserRole] = useState<UserRole>("notSet");
	const [orgName, setOrgName] = useState(gitHubOrgName);
	const [error, setError] = useState<ErrorObjType | undefined>(undefined);

	const setJiraHostUrls = () => {
		AP.getLocation((location: string) => {
			const locationUrl = new URL(location);
			setHostUrl( locationUrl.origin);
		});
	};

	// Authenticate if no token/username is set
	const authenticate = async () => {
		setIsLoading(true);
		try {
			await OAuthManager.authenticateInGitHub(() => {
				setIsLoading(false);
				console.log("Successfully authenticated", username);
			});
		} catch (e) {
			// TODO: print alert error
			console.log("check error", e);
		} finally {
			setIsLoading(false);
		}
	};

	// Finish the OAuth dance if authenticated
	useEffect(() => {
		setJiraHostUrls();
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
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		// Check if the current Github user is admin or not
		const checkOrgOwnership = async () => {
			if (githubInstallationId) {
				const response: CheckOrgOwnershipResponse | AxiosError = await OAuthManager.checkGithubOwnership(parseInt(githubInstallationId));
				if (response instanceof AxiosError) {
					setUserRole("nonAdmin");
				} else {
					setOrgName(response.orgName);
					if(response?.isAdmin){
						connectOrg(response.orgName);
					}
					else{
						setUserRole(response.isAdmin ? "admin" : "nonAdmin");
						setIsLoading(false);
					}
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
		};
		
		isLoggedIn && recheckValidity();
	}, [ isLoggedIn ]);

	const connectOrg = async (orgName: string) => {
		if (githubInstallationId) {
			const connected: boolean | AxiosError = await AppManager.connectOrg(parseInt(githubInstallationId));
			if (connected instanceof AxiosError) {
				setError(modifyError(connected, {}, { onClearGitHubToken: () => {}, onRelogin: () => {} }));
			} else {
				navigate("/spa/connected",{ state: { orgLogin: orgName, isAddMoreOrgAvailable: false } });
			}
		}
	};
	const navigateBackToSteps = () => navigate("/spa/steps");

	const getOrgOwnerUrl = async () => {
		// TODO: Need to get this URL for Enterprise users too, this is only for Cloud users
		popup(`https://github.com/orgs/${orgName}/people?query=role%3Aowner`);
		analyticsClient.sendUIEvent({ actionSubject: "checkOrgAdmin", action: "clicked"}, { type: "cloud" });
	};
	// TODO: orgname is not appearing for all the cases, need to check
	return (
		<Wrapper>
			<SyncHeader />
			{error && <ErrorUI type={error.type} message={error.message} />}
			{isLoading ? (
				<SkeletonForLoading />
			) : (
				<>
					{userRole === "notSet" && (
						<Step
							title={`Connect GitHub organization ${orgName} to Jira Software`}
						>
							<>
								<p css={paragraphStyle}>
									A Jira administrator has asked for approval to connect the
									GitHub organization {orgName} to the Jira site {hostUrl}.
								</p>
								<Box padding="space.200" xcss={boxStyles}>
									<InfoIcon label="differed-installation-info" size="small"/>
									<p css={[paragraphStyle,infoParaStyle]}>
										This will make all repositories in {orgName} available to all projects in {hostUrl}. Import work from those GitHub repositories into Jira.
									</p>
								</Box>
								<Button appearance="primary" onClick={authenticate}>
									sign in & connect
								</Button>
							</>
						</Step>
					)}
					{userRole === "nonAdmin" && (
						<Step title="Can’t connect this organization because you don’t have owner permissions">
							<div css={noAdminDivStyle}>
								<p css={paragraphStyle}>
									The GitHub account you’ve used doesn’t have owner permissions
									for organization {orgName}.
								</p>
								<br/>
								<p css={paragraphStyle}>
									Let the person who sent you the request know to{" "}
									<a css={linkStyle} onClick={getOrgOwnerUrl}>
										find an owner for that organization.
									</a>
								</p>
							</div>
						</Step>
					)}
					{loggedInUser && (
						<LoggedinInfo
							username={loggedInUser}
							logout={navigateBackToSteps}
						/>
					)}
				</>
			)}
		</Wrapper>
	);
};

export default DeferredInstallationRequested;

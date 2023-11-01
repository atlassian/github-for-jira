/** @jsxImportSource @emotion/react */
import { useEffect, useState } from "react";
import Button, { LoadingButton } from "@atlaskit/button";
import AddIcon from "@atlaskit/icon/glyph/editor/add";
import styled from "@emotion/styled";
import { css } from "@emotion/react";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import Step from "../../components/Step";
import LoggedinInfo from "../../common/LoggedinInfo";
import Tooltip, { TooltipPrimitive } from "@atlaskit/tooltip";
import { token } from "@atlaskit/tokens";
import { useNavigate } from "react-router-dom";
import ErrorUI from "../../components/Error";
import AppManager from "../../services/app-manager";
import OAuthManager from "../../services/oauth-manager";
import analyticsClient, { useEffectScreenEvent } from "../../analytics";
import { AxiosError } from "axios";
import { ErrorObjType, GENERIC_MESSAGE_WITH_LINK, HostUrlType, modifyError } from "../../utils/modifyError";
import { reportError } from "../../utils";
import { GitHubInstallationType } from "../../../../src/rest-interfaces";
import OrganizationsList from "../ConfigSteps/OrgsContainer";
import SkeletonForLoading from "../ConfigSteps/SkeletonForLoading";
import OauthManager from "../../services/oauth-manager";
import { ErrorForPopupBlocked } from "../../components/Error/KnownErrors";

type ErrorMessageCounterType = {
	message: string | React.JSX.Element;
	count: number;
}

const configContainerStyle = css`
  margin: 0 auto;
  width: 100%;
  min-height: 364px;
`;
const gitHubOptionContainerStyle = css`
	display: flex;
	margin-bottom: ${token("space.200")};
`;
const tooltipContainerStyle = css`
	margin-bottom: ${token("space.400")};
	a {
		cursor: pointer;
	}
`;
const gitHubOptionStyle = css`
	background: ${token("color.background.accent.gray.subtlest")};
	font-weight: 400;
	color: ${token("color.text")};
	padding: ${token("space.100")} ${token("space.200")};
	margin-right: ${token("space.100")};
	border-radius: 100px;
	display: flex;
	padding: ${token("space.100")} ${token("space.200")};
	cursor: pointer;
	:hover {
		box-shadow: ${token("elevation.shadow.raised")};
		background: rgba(9, 30, 66, 0.08);
	}
	img {
		height: 18px;
		margin-right: ${token("space.100")};
	}
`;

const gitHubSelectedOptionStyle = css`
	background: ${token("color.background.selected")};
	font-weight: 600;
	color: ${token("color.text.selected")};
`;

const InlineDialog = styled(TooltipPrimitive)`
	background: white;
	border-radius: ${token("space.050")};
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	box-sizing: content-box;
	padding: ${token("space.100")} ${token("space.150")};
	width: 280px;
	position: absolute;
	top: -22px;
`;
const addOrganizationContainerStyle = css`
	display: flex;
	align-items: center;
	justify-content: start;
	padding-top: ${token("space.150")};
	button:has( + div:hover) {
		background: ${token("color.background.neutral.hovered")};
	}
	button:has( + div:active) {
		background: ${token("color.background.neutral.pressed")};
	}
	div {
		margin-left: ${token("space.150")};
		color: ${token("color.text")};
		:hover {
			cursor: pointer;
		}
	}
`;
const paragraphStyle = css`
	color: ${token("color.text.subtle")};
	margin-bottom: ${token("space.100")};
`;

// Used for counting messages
const errorMessageCounter: ErrorMessageCounterType = {
	message: "",
	count: 0
};
const ERROR_THRESHOLD = 3;

const ConfigSteps = () => {
	useEffectScreenEvent("AuthorisationScreen");

	const [isPopupBlocked, setPopupBlocked] = useState<boolean>(false);
	const onPopupBlocked = () => setPopupBlocked(true);

	const navigate = useNavigate();
	const { username } = OAuthManager.getUserDetails();
	/**
	 * If GitHub emails are private, then we get null email,
	 * so do not user emails for checking authentication
	 */
	const isAuthenticated = !!username;

	const originalUrl = window.location.origin;
	const [hostUrl, setHostUrl] = useState<HostUrlType | undefined>(undefined);

	const [organizations, setOrganizations] = useState<Array<GitHubInstallationType>>([]);
	const [loaderForOrgFetching, setLoaderForOrgFetching] = useState(true);

	const [selectedOption, setSelectedOption] = useState(1);
	const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated);
	const [loggedInUser, setLoggedInUser] = useState<string | undefined>(username);
	const [loaderForLogin, setLoaderForLogin] = useState(false);
	const [loaderForOrgClicked, setLoaderForOrgClicked] = useState<boolean>(false);

	const [error, setError] = useState<ErrorObjType | undefined>(undefined);

	const showError = (args: ErrorObjType | undefined) => {
		if (args) {
			if (args.message !== errorMessageCounter.message) { // Reset the counter if the error message is different
				errorMessageCounter.message = args.message;
				errorMessageCounter.count = 1;
			} else {
				if (errorMessageCounter.count >= ERROR_THRESHOLD) {
					args.message = GENERIC_MESSAGE_WITH_LINK;
				} else {
					errorMessageCounter.message = args.message;
					errorMessageCounter.count++;
				}
			}
		}
		setError(args);
	};

	const getJiraHostUrls = () => {
		AP.getLocation((location: string) => {
			const locationUrl = new URL(location);
			setHostUrl({
				jiraHost: locationUrl.origin,
			});
		});
	};

	const getOrganizations = async () => {
		setLoaderForOrgFetching(true);
		const response = await AppManager.fetchOrgs();
		setLoaderForOrgFetching(false);
		if (response instanceof AxiosError) {
			showError(modifyError(response, {}, { onClearGitHubToken: clearGitHubToken, onRelogin: reLogin, onPopupBlocked }));
			return { success: false, orgs: [] };
		} else {
			analyticsClient.sendScreenEvent({ name: "OrganisationConnectionScreen" });
			setOrganizations(response.orgs);
			return { success: true, orgs: response.orgs };
		}
	};

	const authorize = async () => {
		switch (selectedOption) {
			case 1: {
				setLoaderForLogin(true);
				try {
					analyticsClient.sendUIEvent({ actionSubject: "startOAuthAuthorisation", action: "clicked"}, { type: "cloud" });
					await OAuthManager.authenticateInGitHub({
						onWinClosed: () => {
							setLoaderForLogin(false);
						}, onPopupBlocked
					});
				} catch (e: unknown) {
					const errorObj = modifyError(e as AxiosError, {}, { onClearGitHubToken: clearGitHubToken, onRelogin: reLogin, onPopupBlocked });
					showError(errorObj);
					analyticsClient.sendTrackEvent({ actionSubject: "finishOAuthFlow", action: "fail"}, { errorCode: errorObj.errorCode, step: "initiate-oauth"});
					reportError(new Error("Fail initiate authorize", { cause: e }), {
						path: "authorize",
						selectedOption
					});
				} finally {
					setLoaderForLogin(false);
				}
				break;
			}
			case 2: {
				analyticsClient.sendUIEvent({ actionSubject: "startOAuthAuthorisation", action: "clicked" }, { type: "ghe" });
				AP.navigator.go( "addonmodule", { moduleKey: "github-server-url-page" });
				break;
			}
			default:
		}
	};

	const clearGitHubToken = () => {
		OAuthManager.clear();
		clearLogin();
	};

	const reLogin = async () => {
		// Clearing the errors
		clearAlerts();
		OauthManager.clear();
		// This resets the token validity check in the parent component and resets the UI
		setIsLoggedIn(false);
		// Restart the whole auth flow
		await OauthManager.authenticateInGitHub({
			onWinClosed: () => {},
			onPopupBlocked
		}).catch(e => {
			const errorObj = modifyError(e, { }, { onClearGitHubToken: () => {}, onRelogin: () => {}, onPopupBlocked });
			analyticsClient.sendTrackEvent({ actionSubject: "finishOAuthFlow", action: "fail"}, { errorCode: errorObj.errorCode, step: "initiate-oauth"});
			reportError(new Error("Reset oauth flow on relogin", { cause: e }), { path: "reLogin" });
		});
	};

	const clearAlerts = () =>{
		showError(undefined);
		setPopupBlocked(false);
	};

	const clearLogin = () => {
		setOrganizations([]);
		setIsLoggedIn(false);
		setLoaderForLogin(false);
		setLoggedInUser("");
		clearAlerts();
	};

	const doCreateConnection = async (gitHubInstallationId: number, mode: "auto" | "manual", orgLogin: string) => {
		try {
			analyticsClient.sendUIEvent(
				{ actionSubject: "connectOrganisation", action: "clicked" },
				{ mode, from: "OrgListScreen" }
			);
			const connected: boolean | AxiosError = await AppManager.connectOrg(gitHubInstallationId);
			if (connected instanceof AxiosError) {
				const errorObj = modifyError(connected, { orgLogin, gitHubInstallationId }, { onClearGitHubToken: clearGitHubToken, onRelogin: reLogin, onPopupBlocked });
				showError(errorObj);
				analyticsClient.sendTrackEvent({ actionSubject: "organisationConnectResponse", action: "fail" }, { mode, errorCode: errorObj.errorCode });
			} else {
				analyticsClient.sendTrackEvent({ actionSubject: "organisationConnectResponse", action: (connected === true ? "success" : "fail") }, { mode });
				navigate("/spa/connected",{ state: { orgLogin } });
			}
		} catch (e: unknown) {
			analyticsClient.sendTrackEvent({ actionSubject: "organisationConnectResponse", action: "fail"}, { mode });
			reportError(new Error("Fail doCreateConnection", { cause: e }), {
				path: "doCreateConnection",
				isGitHubInstallationIdEmpty: !gitHubInstallationId,
				mode
			});
		}
	};

	const installNewOrg = async (mode: "auto" | "manual") => {
		try {
			analyticsClient.sendUIEvent({ actionSubject: "installToNewOrganisation", action: "clicked"}, { mode });
			await AppManager.installNewApp({
				onFinish: async (gitHubInstallationId: number | undefined) => {
					analyticsClient.sendTrackEvent(
						{
							actionSubject: "installNewOrgInGithubResponse",
							action: gitHubInstallationId ? "success" : "fail",
						},
						{ mode }
					);
					const orgsResults = await getOrganizations();
					let orgLogin;
					if (orgsResults?.success) {
						const newOrg = orgsResults?.orgs?.find((org) => org?.id === gitHubInstallationId);
						orgLogin = newOrg?.account?.login;
					}
					if (gitHubInstallationId && orgLogin) {
						await doCreateConnection(gitHubInstallationId, "auto", orgLogin);
					}
				},
				onRequested: async (_setupAction: string) => {
					analyticsClient.sendTrackEvent({ actionSubject: "installNewOrgInGithubResponse", action: "requested"}, { mode });
					navigate("/spa/installationRequested");
				},
				onPopupBlocked
			});
		} catch (e: unknown) {
			const errorObj = modifyError(e as AxiosError, { }, { onClearGitHubToken: clearGitHubToken, onRelogin: reLogin, onPopupBlocked });
			showError(errorObj);
			analyticsClient.sendTrackEvent({ actionSubject: "installNewOrgInGithubResponse", action: "fail"}, { mode, errorCode: errorObj.errorCode });
			reportError(new Error("Fail installNewOrg", { cause: e }), {
				path: "installNewOrg",
				mode
			});
		}
	};

	useEffect(() => {
		getJiraHostUrls();
		const handler = async (event: MessageEvent) => {
			if (event.origin !== originalUrl) return;
			if (event.data?.type === "oauth-callback" && event.data?.code) {
				const response: boolean | AxiosError = await OAuthManager.finishOAuthFlow(event.data?.code, event.data?.state);
				clearAlerts();
				setLoaderForLogin(false);
				if (response instanceof AxiosError) {
					showError(modifyError(response, {}, { onClearGitHubToken: clearGitHubToken, onRelogin: reLogin, onPopupBlocked }));
					analyticsClient.sendTrackEvent({ actionSubject: "finishOAuthFlow", action: "fail" });
					return;
				} else {
					analyticsClient.sendTrackEvent({ actionSubject: "finishOAuthFlow", action: response === true ?  "success" : "fail" });
				}
				setIsLoggedIn(true);
			}
		};
		window.addEventListener("message", handler);
		return () => {
			window.removeEventListener("message", handler);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ originalUrl ]);

	useEffect(() => {
		const recheckValidity = async () => {
			const status: boolean | AxiosError = await OAuthManager.checkValidity();
			if (status instanceof AxiosError) {
				showError(modifyError(status, {}, { onClearGitHubToken: clearGitHubToken, onRelogin: reLogin, onPopupBlocked }));
				return;
			}
			setLoggedInUser(OAuthManager.getUserDetails().username);
			setLoaderForLogin(false);
			setOrganizations([]);
			if (status) {
				const result = await getOrganizations();
				if (result.success && result.orgs.length === 0) {
					await installNewOrg("auto");
				}
				if (result.success) {
					setAnalyticsEventsForFetchedOrgs(result.orgs);
				}
			}
		};
		isLoggedIn && recheckValidity();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isLoggedIn ]);

	return (
		<Wrapper>
			<SyncHeader />
			{
				error && <ErrorUI type={error.type} message={error.message} />
			}
			{isPopupBlocked && (
				<ErrorUI
					type={"error"}
					message={<ErrorForPopupBlocked onDismiss={() => setPopupBlocked(false)}/>}
				/>
			)}

			<div css={configContainerStyle}>
				{
					isLoggedIn ? <>
						{
							loaderForOrgFetching ? <SkeletonForLoading /> : <>
									<Step title="Select a GitHub organization">
												<>
													<div css={paragraphStyle}>
														This organization's repositories will be available to all projects<br />
														in <b>{hostUrl?.jiraHost}</b>.
													</div>
													<OrganizationsList
														organizations={organizations}
														loaderForOrgClicked={loaderForOrgClicked}
														setLoaderForOrgClicked={setLoaderForOrgClicked}
														resetCallback={setIsLoggedIn}
														hostUrl={hostUrl}
														onPopupBlocked={onPopupBlocked}
														connectingOrg={(org) => doCreateConnection(org.id, "manual", org.account?.login)} />
													<div css={addOrganizationContainerStyle}>
														<Button
															iconBefore={<AddIcon label="add new org" size="medium"/>}
															isDisabled={loaderForOrgClicked}
															aria-label="Install organization"
															onClick={() => installNewOrg("manual")}
														/>
														<div onClick={() => !loaderForOrgClicked && installNewOrg("manual")}>
															{ organizations.length === 0 ? "Select an organization in GitHub" : "Select another organization" }
														</div>
													</div>
												</>
											</Step>
									<LoggedinInfo
										username={loggedInUser || ""}
										logout={clearLogin}
										onPopupBlocked={onPopupBlocked}
									/>
								</>
						}
					</>
					: <Step title="Select your GitHub product">
						<>
							<div css={gitHubOptionContainerStyle}>
									<div
										css={selectedOption === 1 ? [gitHubOptionStyle, gitHubSelectedOptionStyle]: [gitHubOptionStyle]}
										onClick={() => {
											setSelectedOption(1);
											analyticsClient.sendUIEvent({ actionSubject: "authorizeTypeGitHubCloud", action: "clicked" });
										}}
									>
										<img src="/public/assets/cloud.svg" alt=""/>
										<span>GitHub Cloud</span>
									</div>
									<div
										css={selectedOption === 2 ? [gitHubOptionStyle, gitHubSelectedOptionStyle]: [gitHubOptionStyle]}
										onClick={() => {
											setSelectedOption(2);
											analyticsClient.sendUIEvent({ actionSubject: "authorizeTypeGitHubEnt", action: "clicked" });
										}}
									>
										<img src="/public/assets/server.svg" alt=""/>
										<span>GitHub Enterprise Server</span>
									</div>
								</div>
								<div css={tooltipContainerStyle}>
									<Tooltip
										component={InlineDialog}
										position="right-end"
										content="If the URL of your GitHub organization contains the domain name “github.com”, select GitHub Cloud. Otherwise, select GitHub Enterprise Server."
									>
										{(props) => <a {...props}>How do I check my GitHub product?</a>}
									</Tooltip>
								</div>
								{
									loaderForLogin ? <LoadingButton appearance="primary" isLoading>Loading</LoadingButton> :
										<Button
											aria-label="Next"
											appearance="primary"
											onClick={authorize}
										>
											Next
										</Button>
								}
							</>
					</Step>
				}
			</div>
		</Wrapper>
	);
};

const setAnalyticsEventsForFetchedOrgs  = (orgs: Array<GitHubInstallationType>) => {
	try {
		const notAdminCount = (orgs || []).filter(o => !o.isAdmin).length;
		const isIPBlockedCount = (orgs || []).filter(o => o.isIPBlocked).length;
		const requiresSsoLoginCount = (orgs || []).filter(o => o.requiresSsoLogin).length;
		analyticsClient.sendTrackEvent({ actionSubject: "organizations", action: "fetched" }, {
			notAdminCount,
			requiresSsoLoginCount,
			isIPBlockedCount,
		});
	} catch (e: unknown) {
		reportError(new Error("Fail setAnalyticsEventsForFetchedOrgs", { cause: e }), {
			path: "setAnalyticsEventsForFetchedOrgs"
		});
	}
};

export default ConfigSteps;

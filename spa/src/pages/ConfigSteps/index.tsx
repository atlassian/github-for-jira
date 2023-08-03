import { useCallback, useEffect, useState } from "react";
import Button, { LoadingButton } from "@atlaskit/button";
import styled from "@emotion/styled";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import CollapsibleStep from "../../components/CollapsibleStep";
import Tooltip, { TooltipPrimitive } from "@atlaskit/tooltip";
import Skeleton from "@atlaskit/skeleton";
import { token } from "@atlaskit/tokens";
import OpenIcon from "@atlaskit/icon/glyph/open";
import SelectDropdown, { LabelType, OrgOptionsType } from "../../components/SelectDropdown";
import OfficeBuildingIcon from "@atlaskit/icon/glyph/office-building";
import { useNavigate } from "react-router-dom";
import Error from "../../components/Error";
import AppManager from "../../services/app-manager";
import OAuthManager from "../../services/oauth-manager";
import analyticsClient from "../../analytics";
import { AxiosError } from "axios";
import { ErrorObjType, modifyError } from "../../utils/modifyError";
import { popup, reportError } from "../../utils";

type GitHubOptionType = {
	selectedOption: number;
	optionKey: number;
};
type HostUrlType = {
	jiraHost: string;
};
type OrgDropdownType = {
	label: string;
	value: number;
};

const ConfigContainer = styled.div`
  margin: 0 auto;
  width: 100%;
  min-height: 364px;
`;
const GitHubOptionContainer = styled.div`
	display: flex;
	margin-bottom: ${token("space.200")};
`;
const TooltipContainer = styled.div`
	margin-bottom: ${token("space.400")};
	a {
		cursor: pointer;
	}
`;
const GitHubOption = styled.div<GitHubOptionType>`
	background: ${props => props.optionKey === props.selectedOption ? "#DEEBFF" : "rgba(9, 30, 66, 0.04)"};
	font-weight: ${props => props.optionKey === props.selectedOption ? 600 : 400};
	color: ${props => props.optionKey === props.selectedOption ? token("color.text.accent.blue") : "inherit"};
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
const LoggedInContent = styled.div`
	display: flex;
	justify-content: start;
	align-items: center;
`;
const ButtonContainer = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
`;
const Paragraph = styled.div`
	color: ${token("color.text.subtle")};
`;
const NoOrgsParagraph = styled.div`
	color: ${token("color.text.subtle")};
	margin-bottom: ${token("space.400")};
`;

const ConfigSteps = () => {
	const navigate = useNavigate();
	const { username } = OAuthManager.getUserDetails();
	/**
	 * If GitHub emails are private, then we get null email,
	 * so do not user emails for checking authentication
	 */
	const isAuthenticated = !!username;

	const originalUrl = window.location.origin;
	const [hostUrl, setHostUrl] = useState<HostUrlType | undefined>(undefined);

	const [organizations, setOrganizations] = useState<Array<OrgOptionsType>>([]);
	const [noOrgsFound, setNoOrgsFound] = useState<boolean>(false);
	const [selectedOrg, setSelectedOrg] = useState<OrgDropdownType | undefined>(undefined);
	const [loaderForOrgFetching, setLoaderForOrgFetching] = useState(true);
	const [loaderForOrgConnection, setLoaderForOrgConnection] = useState(false);
	const [orgConnectionDisabled, setOrgConnectionDisabled] = useState(true);

	const [selectedOption, setSelectedOption] = useState(1);
	const [completedStep1, setCompletedStep1] = useState(isAuthenticated);
	const [completedStep2] = useState(false);

	const [showStep2, setShowStep2] = useState(true);
	const [canViewContentForStep2, setCanViewContentForStep2] = useState(isAuthenticated);

	const [expandStep1, setExpandStep1] = useState(!isAuthenticated);
	const [expandStep2, setExpandStep2] = useState(isAuthenticated);

	const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated);
	const [loggedInUser, setLoggedInUser] = useState<string | undefined>(username);
	const [loaderForLogin, setLoaderForLogin] = useState(false);

	const [error, setError] = useState<ErrorObjType | undefined>(undefined);

	const getJiraHostUrls = () => {
		AP.getLocation((location: string) => {
			const locationUrl = new URL(location);
			setHostUrl({
				jiraHost: locationUrl.origin,
			});
		});
	};

	const getOrganizations = useCallback(async () => {
		setLoaderForOrgFetching(true);
		const response = await AppManager.fetchOrgs();
		setLoaderForOrgFetching(false);
		if (response instanceof AxiosError) {
			setError(modifyError(response, {}, { onClearGitHubToken: clearGitHubToken }));
		} else {
			setNoOrgsFound(response?.orgs.length === 0);
			const totalOrgs = response?.orgs.map(org => ({
				label: org.account.login,
				value: String(org.id),
				requiresSsoLogin: org.requiresSsoLogin,
				isIPBlocked: org.isIPBlocked,
				isAdmin: org.isAdmin
			}));

			const orgsWithSSOLogin = totalOrgs?.filter(org => org.requiresSsoLogin);
			const orgsWithBlockedIp = totalOrgs?.filter(org => org.isIPBlocked);
			const orgsLackAdmin = totalOrgs?.filter(org => !org.isAdmin);
			const enabledOrgs = totalOrgs?.filter(org => !org.requiresSsoLogin && !org.isIPBlocked && org.isAdmin);
			setOrganizations([
				{ options: enabledOrgs },
				{ label: "Lack Admin Permission", options: orgsLackAdmin },
				{ label: "Requires SSO Login", options: orgsWithSSOLogin },
				{ label: "GitHub IP Blocked", options: orgsWithBlockedIp },
			]);
		}
	}, []);

	useEffect(() => {
		getJiraHostUrls();
		const handler = async (event: MessageEvent) => {
			if (event.origin !== originalUrl) return;
			if (event.data?.type === "oauth-callback" && event.data?.code) {
				const response = await OAuthManager.finishOAuthFlow(event.data?.code, event.data?.state);
				setLoaderForLogin(false);
				if (response instanceof AxiosError) {
					setError(modifyError(response, {}, { onClearGitHubToken: clearGitHubToken }));
					analyticsClient.sendTrackEvent({ actionSubject: "finishOAuthFlow", action: "fail" });
					return;
				} else {
					analyticsClient.sendTrackEvent({ actionSubject: "finishOAuthFlow", action: "success" });
				}
				setIsLoggedIn(true);
				setCompletedStep1(true);
				setExpandStep1(false);
				setExpandStep2(true);
				setCanViewContentForStep2(true);
				await getOrganizations();
			}
		};
		window.addEventListener("message", handler);
		return () => {
			window.removeEventListener("message", handler);
		};
	}, [ originalUrl, getOrganizations ]);

	useEffect(() => {
		const recheckValidity = async () => {
			const status: boolean | AxiosError = await OAuthManager.checkValidity();
			if (status instanceof AxiosError) {
				setError(modifyError(status, {}, { onClearGitHubToken: clearGitHubToken }));
				return;
			}
			setLoggedInUser(OAuthManager.getUserDetails().username);
			setLoaderForLogin(false);
			await getOrganizations();
		};
		recheckValidity();
	}, [ isLoggedIn, getOrganizations ]);

	const authorize = async () => {
		switch (selectedOption) {
			case 1: {
				setLoaderForLogin(true);
				try {
					analyticsClient.sendUIEvent({ actionSubject: "startOAuthAuthorisation", action: "clicked", attributes: { type: "cloud" } });
					await OAuthManager.authenticateInGitHub();
				} catch (e) {
					setLoaderForLogin(false);
					setError(modifyError(e as AxiosError, {}, { onClearGitHubToken: clearGitHubToken }));
					reportError(e);
				}
				break;
			}
			case 2: {
				analyticsClient.sendUIEvent({ actionSubject: "startOAuthAuthorisation", action: "clicked", attributes: { type: "ghe" } });
				AP.navigator.go( "addonmodule", { moduleKey: "github-server-url-page" });
				break;
			}
			default:
		}
	};

	const onChangingOrg = (value: LabelType | null) => {
		if(value) {
			if (value?.isIPBlocked) {
				setError(modifyError({ errorCode: "IP_BLOCKED" }, { orgLogin: value.label }, { onClearGitHubToken: clearGitHubToken }));
				setOrgConnectionDisabled(true);
			} else if(value?.requiresSsoLogin) {
				setError(modifyError({ errorCode: "SSO_LOGIN" }, { orgLogin: value.label}, { onClearGitHubToken: clearGitHubToken }));
				setOrgConnectionDisabled(true);
			} else if (!value?.isAdmin) {
				setOrgConnectionDisabled(true);
			}else {
				setSelectedOrg({
					label: value.label,
					value: parseInt(value.value)
				});
				setOrgConnectionDisabled(false);
				setError(undefined);
			}
		}
	};

	const clearGitHubToken = () => {
		OAuthManager.clear();
		setIsLoggedIn(false);
		setCompletedStep1(false);
		setLoaderForLogin(false);
		setCanViewContentForStep2(false);
		setExpandStep1(true);
		setExpandStep2(false);
		setLoggedInUser("");
		setError(undefined);
	};

	const logout = () => {

		popup("https://github.com/logout", { width: 400, height: 600 });
		clearGitHubToken();
		analyticsClient.sendUIEvent({ actionSubject: "switchGitHubAccount", action: "clicked" });
	};

	const doCreateConnection = async (gitHubInstallationId: number, mode: "auto" | "manual") => {
		try {
			setLoaderForOrgConnection(true);
			analyticsClient.sendUIEvent({ actionSubject: "connectOrganisation", action: "clicked" });
			const connected = await AppManager.connectOrg(gitHubInstallationId);
			analyticsClient.sendTrackEvent({ actionSubject: "organisationConnectResponse", action: connected ? "success" : "fail", attributes: { mode } });
			if (connected instanceof AxiosError) {
				setError(modifyError(connected, { }, { onClearGitHubToken: clearGitHubToken }));
			} else {
				navigate("/spa/connected");
			}
		} catch (e) {
			analyticsClient.sendTrackEvent({ actionSubject: "organisationConnectResponse", action: "fail", attributes: { mode } });
			reportError(e);
		} finally {
			setLoaderForOrgConnection(false);
		}
	};

	const connectGitHubOrg = async () => {
		if (selectedOrg?.value) {
			await doCreateConnection(selectedOrg.value, "manual");
		}
	};

	const installNewOrg = async () => {
		try {
			analyticsClient.sendUIEvent({ actionSubject: "installToNewOrganisation", action: "clicked" });
			await AppManager.installNewApp(async (gitHubInstallationId: number | undefined) => {
				analyticsClient.sendTrackEvent({ actionSubject: "installNewOrgInGithubResponse", action: "success" });
				getOrganizations();
				if(gitHubInstallationId) {
					await doCreateConnection(gitHubInstallationId, "auto");
				}
			});
		} catch (e) {
			setError(modifyError(e as AxiosError, { }, { onClearGitHubToken: clearGitHubToken }));
			analyticsClient.sendTrackEvent({ actionSubject: "installNewOrgInGithubResponse", action: "fail" });
			reportError(e);
		}
	};

	return (
		<Wrapper>
			<SyncHeader />
			{
				error && <Error type={error.type} message={error.message} />
			}
			<ConfigContainer>
				<CollapsibleStep
					step="1"
					title="Log in and authorize"
					canViewContent={true}
					expanded={expandStep1}
					completed={completedStep1}
				>
					{
						isLoggedIn ? <>
							{
								loaderForLogin ? <>
									<Skeleton
										width="100%"
										height="24px"
										borderRadius="5px"
										isShimmering
									/>
								</> : <LoggedInContent>
									<div>Logged in as <b>{loggedInUser}</b>.&nbsp;</div>
									<Button style={{ paddingLeft: 0 }} appearance="link" onClick={logout}>Change GitHub login</Button>
								</LoggedInContent>
							}
						</> : <>
							<GitHubOptionContainer>
								<GitHubOption
									optionKey={1}
									selectedOption={selectedOption}
									onClick={() => {
										setShowStep2(true);
										setSelectedOption(1);
										analyticsClient.sendUIEvent({ actionSubject: "authorizeTypeGitHubCloud", action: "clicked" });
									}}
								>
									<img src="/public/assets/cloud.svg" alt=""/>
									<span>GitHub Cloud</span>
								</GitHubOption>
								<GitHubOption
									optionKey={2}
									selectedOption={selectedOption}
									onClick={() => {
										setShowStep2(false);
										setSelectedOption(2);
										analyticsClient.sendUIEvent({ actionSubject: "authorizeTypeGitHubEnt", action: "clicked" });
									}}
								>
									<img src="/public/assets/server.svg" alt=""/>
									<span>GitHub Enterprise Server</span>
								</GitHubOption>
							</GitHubOptionContainer>
							<TooltipContainer>
								<Tooltip
									component={InlineDialog}
									position="right-end"
									content="If the URL of your GitHub organization contains the domain name “github.com”, select GitHub Cloud. Otherwise, select GitHub Enterprise Server."
								>
									{(props) => <a {...props}>How do I check my GitHub product?</a>}
								</Tooltip>
							</TooltipContainer>
							{
								loaderForLogin ? <LoadingButton appearance="primary" isLoading>Loading</LoadingButton> :
								<Button
									iconAfter={<OpenIcon label="open" size="medium"/>}
									aria-label="Authorize in GitHub"
									appearance="primary"
									onClick={authorize}
								>
									Authorize in GitHub
								</Button>
							}
						</>
					}
				</CollapsibleStep>

				{
					showStep2 && <CollapsibleStep
						step="2"
						title="Connect your GitHub organization to Jira"
						canViewContent={canViewContentForStep2}
						expanded={expandStep2}
						completed={completedStep2}
					>
						{
							loaderForOrgFetching ? <>
								<Skeleton
									width="100%"
									height="24px"
									borderRadius="5px"
									isShimmering
								/>
							</> : (
								noOrgsFound ?
									<>
										<NoOrgsParagraph>We couldn’t find any GitHub organizations that you’re an owner of.</NoOrgsParagraph>
										<Button appearance="primary" aria-label="Install new Org" onClick={installNewOrg}>Try installing to your GitHub organization</Button>
									</> :
									<>
										<Paragraph>
											Repositories from this organization will be available to all <br />
											projects in <b>{hostUrl?.jiraHost}</b>.
										</Paragraph>

										<SelectDropdown
											options={organizations}
											label="Select organization"
											isLoading={loaderForOrgFetching}
											onChange={onChangingOrg}
											icon={<OfficeBuildingIcon label="org" size="medium" />}
										/>
										<TooltipContainer>
											<Tooltip
												component={InlineDialog}
												position="right-end"
												content="Don’t see the organization you want to connect in the list above? You will need the role of an owner in GitHub your organization to do so. Please contact your company’s GitHub owner."
											>
												{(props) => <a {...props}>Can't find an organization you're looking for?</a>}
											</Tooltip>
										</TooltipContainer>
										{
											loaderForOrgConnection ? <LoadingButton appearance="primary" isLoading>Loading</LoadingButton> :
												<ButtonContainer>
													<Button appearance="primary" onClick={connectGitHubOrg} isDisabled={orgConnectionDisabled}>Connect GitHub organization</Button>
													<Button appearance="subtle" onClick={installNewOrg}>Install to another GitHub organization</Button>
												</ButtonContainer>
										}
									</>
							)
						}
					</CollapsibleStep>
				}
			</ConfigContainer>
		</Wrapper>
	);
};

export default ConfigSteps;

import { useEffect, useState } from "react";
import Button, { LoadingButton } from "@atlaskit/button";
import AddIcon from "@atlaskit/icon/glyph/editor/add";
import styled from "@emotion/styled";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import Step from "../../components/Step";
import Tooltip, { TooltipPrimitive } from "@atlaskit/tooltip";
import Skeleton from "@atlaskit/skeleton";
import { token } from "@atlaskit/tokens";
import OpenIcon from "@atlaskit/icon/glyph/open";
import { useNavigate } from "react-router-dom";
import Error from "../../components/Error";
import AppManager from "../../services/app-manager";
import OAuthManager from "../../services/oauth-manager";
import analyticsClient from "../../analytics";
import { AxiosError } from "axios";
import { ErrorObjType, modifyError } from "../../utils/modifyError";
import { popup, reportError } from "../../utils";
import { GitHubInstallationType } from "../../../../src/rest-interfaces";

type GitHubOptionType = {
	selectedOption: number;
	optionKey: number;
};
type HostUrlType = {
	jiraHost: string;
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
const AddOrganizationContainer = styled.div`
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
const LoggedInContent = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	margin: 0 auto;
`;
const OrgsContainer = styled.div`
	max-height: 250px;
	overflow-y: auto;
	padding-right: 80px;
	margin-right: -80px;
`;
const OrgDiv = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: ${token("space.150")} 0;
	margin-bottom: ${token("space.100")};
`;
const Paragraph = styled.div`
	color: ${token("color.text.subtle")};
	margin-bottom: ${token("space.100")};
`;
const NoOrgsParagraph = styled.div`
	color: ${token("color.text.subtle")};
	margin: ${token("space.200")} 0;
	text-align: center;
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

	const [organizations, setOrganizations] = useState<Array<GitHubInstallationType>>([]);
	const [loaderForOrgFetching, setLoaderForOrgFetching] = useState(true);

	const [selectedOption, setSelectedOption] = useState(1);
	const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated);
	const [loggedInUser, setLoggedInUser] = useState<string | undefined>(username);
	const [loaderForLogin, setLoaderForLogin] = useState(false);

	const [clickedOrg, setClickedOrg] = useState<number>(0);
	const [loaderForOrgClicked, setLoaderForOrgClicked] = useState<boolean>(false);
	const [hasRequestedOrgsInstallation, setHasRequestedOrgsInstallation] = useState<boolean>(false);

	const [error, setError] = useState<ErrorObjType | undefined>(undefined);

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
			setError(modifyError(response, {}, { onClearGitHubToken: clearGitHubToken }));
			return { success: false, orgs: [] };
		} else {
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
					await OAuthManager.authenticateInGitHub(() => {
						setLoaderForLogin(false);
					});
				} catch (e) {
					setLoaderForLogin(false);
					setError(modifyError(e as AxiosError, {}, { onClearGitHubToken: clearGitHubToken }));
					reportError(e);
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
		setIsLoggedIn(false);
		setLoaderForLogin(false);
		setLoggedInUser("");
		setError(undefined);
	};

	const logout = () => {
		popup("https://github.com/logout");
		clearGitHubToken();
		analyticsClient.sendUIEvent({ actionSubject: "switchGitHubAccount", action: "clicked" });
	};

	const doCreateConnection = async (gitHubInstallationId: number, mode: "auto" | "manual", orgLogin?: string) => {
		try {
			analyticsClient.sendUIEvent({ actionSubject: "connectOrganisation", action: "clicked" });
			const connected = await AppManager.connectOrg(gitHubInstallationId);
			analyticsClient.sendTrackEvent({ actionSubject: "organisationConnectResponse", action: connected ? "success" : "fail"}, { mode });
			if (connected instanceof AxiosError) {
				setError(modifyError(connected, { orgLogin }, { onClearGitHubToken: clearGitHubToken }));
			} else {
				navigate("/spa/connected");
			}
		} catch (e) {
			analyticsClient.sendTrackEvent({ actionSubject: "organisationConnectResponse", action: "fail"}, { mode });
			reportError(e);
		}
	};

	const installNewOrg = async (mode: "auto" | "manual") => {
		try {
			analyticsClient.sendUIEvent({ actionSubject: "installToNewOrganisation", action: "clicked"}, { mode });
			await AppManager.installNewApp({
				onFinish: async (gitHubInstallationId: number | undefined) => {
					analyticsClient.sendTrackEvent({ actionSubject: "installNewOrgInGithubResponse", action: "success"}, { mode });
					getOrganizations();
					if(gitHubInstallationId) {
						await doCreateConnection(gitHubInstallationId, "auto");
					}
				},
				onRequested: async (_setupAction: string) => {
					setHasRequestedOrgsInstallation(true);
				}
			});
		} catch (e) {
			setError(modifyError(e as AxiosError, { }, { onClearGitHubToken: clearGitHubToken }));
			analyticsClient.sendTrackEvent({ actionSubject: "installNewOrgInGithubResponse", action: "fail" });
			reportError(e);
		}
	};

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
			}
		};
		window.addEventListener("message", handler);
		return () => {
			window.removeEventListener("message", handler);
		};
	}, [ originalUrl ]);

	useEffect(() => {
		const recheckValidity = async () => {
			const status: boolean | AxiosError = await OAuthManager.checkValidity();
			if (status instanceof AxiosError) {
				setError(modifyError(status, {}, { onClearGitHubToken: clearGitHubToken }));
				return;
			}
			setLoggedInUser(OAuthManager.getUserDetails().username);
			setLoaderForLogin(false);
			setOrganizations([]);
			if (status === true) {
				const result = await getOrganizations();
				if (result.success && result.orgs.length === 0) {
					if (result.orgs.length === 0) {
						await installNewOrg("auto");
					}
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
				error && <Error type={error.type} message={error.message} />
			}
			<ConfigContainer>
				{
					isLoggedIn ? <>
						{
							loaderForOrgFetching ?
								<>
									<Step
										title={<Skeleton
											width="60%"
											height="24px"
											borderRadius="5px"
											isShimmering
										/>}
									>
										<Skeleton
											width="100%"
											height="24px"
											borderRadius="5px"
											isShimmering
										/>
									</Step>
									<LoggedInContent>
										<Skeleton
											width="60%"
											height="24px"
											borderRadius="5px"
											isShimmering
										/>
									</LoggedInContent>
								</> : <>
									{
										hasRequestedOrgsInstallation ? <Step title="Request sent">
											<Paragraph>
												A request is sent to your GitHub organization owner. Once your<br/>
												request is granted, come back to complete the configuration.
											</Paragraph>
										</Step> :
										<Step title="Connect your GitHub organization to Jira">
												<>
													<Paragraph>
														Repositories from this organization will be available to all<br />
														projects in <b>{hostUrl?.jiraHost}</b>.
													</Paragraph>
													{
														organizations.length === 0 &&
														<NoOrgsParagraph>No organizations found!</NoOrgsParagraph>
													}
													<OrgsContainer>
														{
															organizations.map(org =>
																<OrgDiv key={org.id}>
																	<span>{org.account.login}</span>
																	{
																		loaderForOrgClicked && clickedOrg === org.id ?
																			<LoadingButton style={{width: 80}} isLoading>Loading button</LoadingButton> :
																			<Button
																				isDisabled={loaderForOrgClicked && clickedOrg !== org.id}
																				onClick={async () => {
																					setLoaderForOrgClicked(true);
																					setClickedOrg(org.id);
																					try {
																						await doCreateConnection(org.id, "manual", org.account?.login);
																					} finally {
																						setLoaderForOrgClicked(false);
																					}
																				}}
																			>
																				Connect
																			</Button>
																	}
																</OrgDiv>
															)
														}
													</OrgsContainer>
													<AddOrganizationContainer>
														<Button
															iconBefore={<AddIcon label="add new org" size="medium"/>}
															isDisabled={loaderForOrgClicked}
															aria-label="Install new Org"
															onClick={() => installNewOrg("manual")}
														/>
														<div onClick={() => !loaderForOrgClicked && installNewOrg("manual")}>
															Add an organization
														</div>
													</AddOrganizationContainer>
												</>
											</Step>
									}
									<LoggedInContent>
										<div data-testid="logged-in-as">Logged in as <b>{loggedInUser}</b>.&nbsp;</div>
										<Button style={{ paddingLeft: 0 }} appearance="link" onClick={logout}>Change GitHub login</Button>
									</LoggedInContent>
								</>
						}
					</>
					: <Step title="Select your GitHub product">
						<>
							<GitHubOptionContainer>
									<GitHubOption
										optionKey={1}
										selectedOption={selectedOption}
										onClick={() => {
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
											aria-label="Get started"
											appearance="primary"
											onClick={authorize}
										>
											Get started
										</Button>
								}
							</>
					</Step>
				}


			</ConfigContainer>
		</Wrapper>
	);
};

export default ConfigSteps;

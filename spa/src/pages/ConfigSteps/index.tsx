import { useEffect, useState } from "react";
import Button, { LoadingButton } from "@atlaskit/button";
import styled from "@emotion/styled";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import CollapsibleStep from "../../components/CollapsibleStep";
import Tooltip, { TooltipPrimitive } from "@atlaskit/tooltip";
import Skeleton from "@atlaskit/skeleton";
import { token } from "@atlaskit/tokens";
import OpenIcon from "@atlaskit/icon/glyph/open";
import SelectDropdown, { LabelType } from "../../components/SelectDropdown";
import OfficeBuildingIcon from "@atlaskit/icon/glyph/office-building";
import { useNavigate } from "react-router-dom";
import { ErrorType } from "../../rest-interfaces/oauth-types";
import Error from "../../components/Error";
import AppManager from "../../services/app-manager";
import OAuthManager from "../../services/oauth-manager";

type GitHubOptionType = {
	selectedOption: number;
	optionKey: number;
};
type HostUrlType = {
	jiraHost: string;
	gheServerUrl: string;
};
type OrgDropdownType = {
	label: string;
	value: number;
};
type ErrorObjType = {
	type: ErrorType,
	message: React.JSX.Element | string;
}

const ConfigContainer = styled.div`
	margin: 0 auto;
	width: 100%;
`;
const GitHubOptionContainer = styled.div`
	display: flex;
	margin-bottom: ${token("space.200")};
`;
const TooltipContainer = styled.div`
	margin-bottom: ${token("space.200")};
	a {
		cursor: pointer;
	}
`;
const GitHubOption = styled.div<GitHubOptionType>`
	background: ${props => props.optionKey === props.selectedOption ? "#DEEBFF" : token("color.background.neutral")};
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
const ButtonContainer = LoggedInContent;
const Paragraph = styled.div`
	color: ${token("color.text.subtle")};
`;

const ConfigSteps = () => {
	const navigate = useNavigate();
	const { username, email } = OAuthManager.getUserDetails();
	const isAuthenticated = !!(username && email);

	const originalUrl = window.location.origin;
	const [hostUrl, setHostUrl] = useState<HostUrlType | undefined>(undefined);

	const [organizations, setOrganizations] = useState<Array<LabelType>>([]);
	const [selectedOrg, setSelectedOrg] = useState<OrgDropdownType | undefined>(undefined);
	const [loaderForOrgFetching, setLoaderForOrgFetching] = useState(false);
	const [loaderForOrgConnection, setLoaderForOrgConnection] = useState(false);
	const [orgConnectionDisabled, setOrgConnectionDisabled] = useState(true);

	const [selectedOption, setSelectedOption] = useState(0);
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
				gheServerUrl: locationUrl?.href.replace("/spa-index-page", "/github-server-url-page")
			});
		});
	};

	const getOrganizations = async () => {
		setLoaderForOrgFetching(true);
		const response = await AppManager.fetchOrgs();
		if (response) {
			setOrganizations(response?.orgs.map((org: any) => ({
				label: org.account.login,
				value: org.id,
			})));
		}
		setLoaderForOrgFetching(false);
	};

	useEffect(() => {
		getJiraHostUrls();
		const handler = async (event: any) => {
			if (event.origin !== originalUrl) return;
			if (event.data?.code) {
				const success = await OAuthManager.finishOAuthFlow(event.data?.code, event.data?.state);
				if (!success) {
					setError({ type: "error", message: "Failed to finish authentication!"});
					return;
				}
			}
			setIsLoggedIn(true);
			setCompletedStep1(true);
			setExpandStep1(false);
			setExpandStep2(true);
			setCanViewContentForStep2(true);
			await getOrganizations();
		};
		window.addEventListener("message", handler);
		return () => {
			window.removeEventListener("message", handler);
		};
	}, []);

	useEffect(() => {
		OAuthManager.checkValidity().then((status: boolean | undefined) => {
			if (status) {
				setLoggedInUser(OAuthManager.getUserDetails().username);
				setLoaderForLogin(false);
				getOrganizations();
			}
		});
	}, [isLoggedIn]);

	const authorize = async () => {
		switch (selectedOption) {
			case 1: {
				setLoaderForLogin(true);
				try {
					await OAuthManager.authenticateInGitHub();
				} catch (e) {
					setLoaderForLogin(false);
					setError({ type: "error", message: "Couldn't login!"});
				}
				break;
			}
			case 2: {
				if (hostUrl?.gheServerUrl) {
					window.open(hostUrl?.gheServerUrl);
				}
				break;
			}
			default:
		}
	};

	const logout = () => {
		window.open("https://github.com/logout");
		OAuthManager.clear();
		setIsLoggedIn(false);
		setCompletedStep1(false);
		setLoaderForLogin(false);
		setCanViewContentForStep2(false);
		setExpandStep1(true);
		setExpandStep2(false);
		setLoggedInUser("");
	};

	const connectGitHubOrg = async () => {
		if (selectedOrg?.value) {
			setLoaderForOrgConnection(true);
			const connected = await AppManager.connectOrg(selectedOrg?.value);
			if (connected) {
				navigate("/spa/connected");
			} else {
				setError({ type: "error", message: "Something went wrong and we couldn’t connect to GitHub, try again." });
			}
			setLoaderForOrgConnection(false);
		}
	};

	const installNewOrg = async () => {
		try {
			await AppManager.installNewApp(() => {
				getOrganizations();
			});
		} catch (e) {
			setError({type: "error", message: "Couldn't install new organization"});
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
									}}
								>
									<img src="/spa-assets/cloud.svg" alt=""/>
									<span>GitHub Cloud</span>
								</GitHubOption>
								<GitHubOption
									optionKey={2}
									selectedOption={selectedOption}
									onClick={() => {
										setShowStep2(false);
										setSelectedOption(2);
									}}
								>
									<img src="/spa-assets/server.svg" alt=""/>
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
						<>
							<Paragraph>
								Repositories from this organization will be available to all <br />
								projects in <b>{hostUrl?.jiraHost}</b>.
							</Paragraph>

							<SelectDropdown
								options={organizations}
								label="Select organization"
								isLoading={loaderForOrgFetching}
								onChange={(value) => {
									setOrgConnectionDisabled(false);
									setSelectedOrg(value);
								}}
								icon={<OfficeBuildingIcon label="org" size="medium" />}
							/>
							{
								loaderForOrgConnection ? <LoadingButton appearance="primary" isLoading>Loading</LoadingButton> :
									<ButtonContainer>
										<Button appearance="primary" onClick={connectGitHubOrg} isDisabled={orgConnectionDisabled}>Connect GitHub organization</Button>
										<Button appearance="subtle" onClick={installNewOrg}>Install to another GitHub organization</Button>
									</ButtonContainer>
							}
						</>
					</CollapsibleStep>
				}
			</ConfigContainer>
		</Wrapper>
	);
};

export default ConfigSteps;

import { useEffect, useState } from "react";
import Button from "@atlaskit/button";
import styled from "@emotion/styled";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import CollapsibleStep from "../../components/CollapsibleStep";
import Tooltip, { TooltipPrimitive } from "@atlaskit/tooltip";
import Skeleton from "@atlaskit/skeleton";
import { token } from "@atlaskit/tokens";
import OpenIcon from "@atlaskit/icon/glyph/open";

type GitHubOptionType = {
	selectedOption: number;
	optionKey: number;
}

const ConfigContainer = styled.div`
	max-width: 580px;
	margin: 0 auto;
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

const ConfigSteps = () => {
	const originalUrl = window.location.origin;
	const [selectedOption, setSelectedOption] = useState(0);

	const [completedStep1, setCompletedStep1] = useState(false);
	const [completedStep2] = useState(false);

	const [showStep2, setShowStep2] = useState(true);
	const [canViewContentForStep2, setCanViewContentForStep2] = useState(false);

	const [expandStep1, setExpandStep1] = useState(true);
	const [expandStep2] = useState(false);

	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [loggedInUser, setLoggedInUser] = useState("");
	const [loaderForLogin, setLoaderForLogin] = useState(false);
	console.log("Check the values now", OAuthManagerInstance.getUserDetails());

	useEffect(() => {
		window.addEventListener("message", (event) => {
			if (event.origin !== originalUrl) return;
			OAuthManagerInstance.setTokens(event.data.accessToken, event.data.refreshToken);
			setIsLoggedIn(true);
			setCompletedStep1(true);
			setExpandStep1(false);
			setCanViewContentForStep2(true);
		});
	}, []);

	useEffect(() => {
		OAuthManagerInstance.checkValidity().then((status: boolean | undefined) => {
			if (status) {
				setLoggedInUser(OAuthManagerInstance.getUserDetails().username);
				setLoaderForLogin(false);
			}
		});
	}, [isLoggedIn]);

	const authorize = async () => {
		switch (selectedOption) {
			case 1: {
				setLoaderForLogin(true);
				await OAuthManagerInstance.authenticateInGitHub();
				break;
			}
			case 2: {
				AP.getLocation((location: string) => {
					const GHEServerUrl = location.replace("/spa-index-page", "/github-server-url-page");
					window.open(GHEServerUrl);
				});
				break;
			}
			default:
		}
	};

	return (
		<Wrapper>
			<SyncHeader />
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
								</> : <>
									Logged in as <b>{loggedInUser}</b>. <a href="https://github.com/logout" target="_blank">Change GitHub login</a>
								</>
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
							<Button
								iconAfter={<OpenIcon label="open" size="medium"/>}
								appearance="primary"
								onClick={authorize}
							>
								Authorize in GitHub
							</Button>
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
						<div>Content inside</div>
					</CollapsibleStep>
				}
			</ConfigContainer>
		</Wrapper>
	);
};

export default ConfigSteps;

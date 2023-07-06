import { useState } from "react";
import Button from "@atlaskit/button";
import styled from "@emotion/styled";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import CollapsibleStep from "../../components/CollapsibleStep";
import Tooltip, { TooltipPrimitive } from "@atlaskit/tooltip";
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
	const [completedStep1, setCompletedStep1] = useState(false);
	const [completedStep2] = useState(false);
	const [canViewContentForStep2, setCanViewContentForStep2] = useState(false);
	const [selectedOption, setSelectedOption] = useState(0);

	const authorize = () => {
		switch (selectedOption) {
			// TODO: Authorize
			case 1:
				setCompletedStep1(!completedStep1);
				setCanViewContentForStep2(!canViewContentForStep2);
				break;
			case 2:
				AP.navigator.go(
					"addonmodule",
					{
						moduleKey: "github-server-url-page"
					}
				);
				break;
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
					expanded={true}
					completed={completedStep1}
				>
					<>
						<GitHubOptionContainer>
							<GitHubOption
								optionKey={1}
								selectedOption={selectedOption}
								onClick={() => setSelectedOption(1)}
							>
								<img src="/spa-assets/cloud.svg" alt=""/>
								<span>Github Cloud</span>
							</GitHubOption>
							<GitHubOption
								optionKey={2}
								selectedOption={selectedOption}
								onClick={() => setSelectedOption(2)}
							>
								<img src="/spa-assets/server.svg" alt=""/>
								<span>Github Enterprise Server</span>
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
				</CollapsibleStep>
				<CollapsibleStep
					step="2"
					title="Connect your GitHub organization to Jira"
					canViewContent={canViewContentForStep2}
					expanded={false}
					completed={completedStep2}
				>
					<div>Content inside</div>
				</CollapsibleStep>
			</ConfigContainer>
		</Wrapper>
	);
};

export default ConfigSteps;

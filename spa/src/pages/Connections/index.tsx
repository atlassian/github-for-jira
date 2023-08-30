import { useEffect, useState } from "react";
import { token } from "@atlaskit/tokens";
import styled from "@emotion/styled";

import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";

const Paragraph = styled.p`
	color: ${token("color.text.subtle")};
	margin-bottom: ${token("space.200")};
`;

type GitHubOptionType = {
	selectedOption: number;
	optionKey: number;
};

const GitHubOptionContainer = styled.div`
	display: flex;
	margin-bottom: ${token("space.200")};
`;

const GitHubOption = styled.div<GitHubOptionType>`
	background: ${(props) =>
		props.optionKey === props.selectedOption
			? token("color.background.selected")
			: token("color.background.accent.gray.subtlest")};
	font-weight: ${(props) =>
		props.optionKey === props.selectedOption ? 600 : 400};
	color: ${(props) =>
		props.optionKey === props.selectedOption
			? token("color.text.selected")
			: token("color.text")};
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

// const connectionWrapper = styled.Wrapper``

const Connections = () => {
	useEffect(() => {}, []);
	const [selectedOption, setSelectedOption] = useState(1);

	return (
		<Wrapper>
			<SyncHeader />
			<Paragraph>
				Connecting GitHub to Jira allows you to view development activity in the
				context of your Jira project and issues. To send development data from
				GitHub to Jira, your team must include issue keys in branch names,
				commit messages, and pull request titles. Even if your organization is
				still backfilling historical data, you can start using issue keys in
				your development work immediately.
			</Paragraph>
			<GitHubOptionContainer>
				<GitHubOption
					optionKey={1}
					selectedOption={selectedOption}
					onClick={() => {
						setSelectedOption(1);
					}}
				>
					<span>All</span>
				</GitHubOption>
				<GitHubOption
					optionKey={2}
					selectedOption={selectedOption}
					onClick={() => {
						setSelectedOption(2);
					}}
				>
					<img src="/public/assets/cloud.svg" alt="" />
					<span>GitHub Cloud</span>
				</GitHubOption>
				<GitHubOption
					optionKey={3}
					selectedOption={selectedOption}
					onClick={() => {
						setSelectedOption(3);
					}}
				>
					<img src="/public/assets/server.svg" alt="" />
					<span>GitHub Enterprise Server</span>
				</GitHubOption>
			</GitHubOptionContainer>
			<h3>GitHub Cloud</h3>
			<h3>GitHub Enterprise Server</h3>
			
		</Wrapper>
	);
};

export default Connections;

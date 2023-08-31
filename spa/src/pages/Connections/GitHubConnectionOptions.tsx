import { token } from "@atlaskit/tokens";
import styled from "@emotion/styled";

type GitHubConnectionOptionsProps = {
	selectedOption: number;
	setSelectedOption: (option: number) => void;
};
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

const GitHubConnectionOptions = ({
	selectedOption,
	setSelectedOption,
}: GitHubConnectionOptionsProps) => {
	return (
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
	);
};

export default GitHubConnectionOptions;

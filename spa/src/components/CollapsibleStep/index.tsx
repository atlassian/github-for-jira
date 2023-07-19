import { useEffect, useState } from "react";
import { token } from "@atlaskit/tokens";
import styled from "@emotion/styled";
import CheckIcon from "@atlaskit/icon/glyph/check";

type ContainerType = {
	isExpanded: boolean
}

const Container = styled.div<ContainerType>`
	width: 100%;
	border: ${token("space.025")} solid ${token("color.border")};
	border-radius: ${token("space.050")};
	padding: ${token("space.400")};
	margin: ${token("space.400")} 0;
	box-sizing: border-box;
	background: ${props => props.isExpanded ? "transparent" : token("elevation.surface.sunken")};
`;
const Header = styled.div`
	display: flex;
	line-height: ${token("space.400")};
	align-items: center;
`;
const StepNumber = styled.span`
	background: ${token("color.background.accent.gray.subtlest")};
	height: ${token("space.400")};
	width: ${token("space.400")};
	text-align: center;
	border-radius: 50%;
`;
const CompletedIcon = styled.span`
	height: ${token("space.400")};
	width: ${token("space.400")};
	display: flex;
	justify-content: end;
	align-items: center;
`;
const StepTitle = styled.span`
	cursor: pointer;
	font-weight: 600;
	margin: 0 0 0 ${token("space.200")};
`;
const Content = styled.div`
	margin: ${token("space.200")} 0 0 ${token("space.600")};
`;

const CollapsibleStep = ({
	title,
	step,
	expanded = false,
	completed = false,
	canViewContent,
	children,
}: {
	title: string,
	step: string,
	canViewContent: boolean,
	expanded?: boolean,
	completed?: boolean,
	children: JSX.Element,
}) => {
	const [ isExpanded, setIsExpanded ] = useState(expanded);

	useEffect(() => {
		setIsExpanded(expanded);
	}, [expanded]);

	const clickedTitle = () => {
		if (canViewContent) {
			setIsExpanded(!isExpanded);
		}
	};

	return (
		<Container isExpanded={isExpanded}>
			<Header>
				{
					completed ? (
						<CompletedIcon>
							<CheckIcon label="completed" primaryColor={token("color.icon.success")} />
						</CompletedIcon>
					) : <StepNumber>{step}</StepNumber>
				}
				<StepTitle onClick={clickedTitle}>{title}</StepTitle>
			</Header>
			{
				isExpanded && (
					<Content data-testid="collapsible-content">
						{children}
					</Content>
				)
			}
		</Container>
	);
};

export default CollapsibleStep;

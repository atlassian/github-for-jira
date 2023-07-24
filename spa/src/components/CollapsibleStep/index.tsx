import { useEffect, useState } from "react";
import { token } from "@atlaskit/tokens";
import styled from "@emotion/styled";
import CheckCircleIcon from "@atlaskit/icon/glyph/check-circle";

type ContainerType = {
	isExpanded: boolean
}

const Container = styled.div<ContainerType>`
	width: 100%;
	border: ${props => props.isExpanded ? `${token("space.025")} solid ${token("color.border")}` : "none"};
	border-radius: ${token("space.050")};
	padding: ${token("space.400")};
	margin: 0 0 ${token("space.100")};
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
	font-weight: 600;
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
const StepTitle = styled.span<ContainerType>`
	cursor: pointer;
	font-weight: 600;
	margin: 0 0 0 ${token("space.200")};
	color: ${props => props.isExpanded ? token("color.text") : token("color.text.subtlest") }
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
							<CheckCircleIcon label="completed" primaryColor={token("color.icon.success")} />
						</CompletedIcon>
					) : <StepNumber>{step}</StepNumber>
				}
				<StepTitle isExpanded={isExpanded} onClick={clickedTitle}>{title}</StepTitle>
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

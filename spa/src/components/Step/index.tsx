import { token } from "@atlaskit/tokens";
import styled from "@emotion/styled";

const Container = styled.div`
	width: 100%;
	border: ${token("space.025")} solid ${token("color.border")};
	border-radius: ${token("space.050")};
	padding: ${token("space.400")} 80px;
	box-sizing: border-box;
	background: transparent;
	margin: 0 0 ${token("space.100")};
`;
const Header = styled.div`
	line-height: ${token("space.400")};
	align-items: center;
`;
const StepTitle = styled.div`
	cursor: pointer;
	font-weight: 600;
	font-size: ${token("space.200")};
	color: token("color.text");
	margin: 0 0 ${token("space.100")};
`;

const Step = ({
	title,
	children,
}: {
	title: string | JSX.Element,
	children: JSX.Element,
}) => {
	return (
		<Container>
			<Header>
				<StepTitle>{title}</StepTitle>
			</Header>
				<div data-testid="content">
					{children}
				</div>
		</Container>
	);
};

export default Step;

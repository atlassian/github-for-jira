import styled from "@emotion/styled";
import { ErrorType } from "../../rest-interfaces/oauth-types";
import { token } from "@atlaskit/tokens";

type ErrorWrapperType = {
	type: ErrorType
}

const ErrorWrapper = styled.div<ErrorWrapperType>`
	min-width: 580px;
	box-sizing: border-box;
	padding: ${token("space.200")};
	margin: ${token("space.200")} auto;
	text-align: left;
	background: ${props => props.type === "info" ? token("color.background.warning") : token("color.background.danger") };
	border-radius: 3px;
`;

const Error = ({
	type,
}: {
	type: ErrorType
}) => {


	return (
		<ErrorWrapper type={type}>
			This is an error {type}
		</ErrorWrapper>
	);
};

export default Error;

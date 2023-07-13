import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";
import WarningIcon from "@atlaskit/icon/glyph/warning";
import ErrorIcon from "@atlaskit/icon/glyph/error";
import { ErrorType } from "../../rest-interfaces/oauth-types";

type ErrorWrapperType = {
	type: ErrorType
}

const ErrorWrapper = styled.div<ErrorWrapperType>`
	display: flex;
	justify-content: start;
	min-width: 580px;
	box-sizing: border-box;
	padding: ${token("space.200")};
	margin: ${token("space.200")} auto;
	text-align: left;
	background: ${props => props.type === "info" ? token("color.background.warning") : token("color.background.danger") };
	border-radius: 3px;
	align-items: center;
	span {
		padding-left: ${token("space.100")};
	}
`;

const Error = ({
	type,
	message,
}: {
	type: ErrorType,
	message: string
}) => {


	return (
		<ErrorWrapper type={type}>
			{
				type === "info" ? <WarningIcon label="warning" size="small" /> :
					<ErrorIcon label="warning" size="small" />
			}
			<span>{message}</span>
		</ErrorWrapper>
	);
};

export default Error;

/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import WarningIcon from "@atlaskit/icon/glyph/warning";
import ErrorIcon from "@atlaskit/icon/glyph/error";
import { ErrorType } from "rest-interfaces";

const errorWrapperStyle = css`
	display: flex;
	justify-content: start;
	width: 100%;
	box-sizing: border-box;
	padding: ${token("space.200")};
	margin: ${token("space.200")} auto;
	text-align: left;
	background: ${token("color.background.danger")};
	border-radius: 3px;
	align-items: center;
	span {
		align-self: start;
	}
`;

const errorWrapperWithWarningStyle = css`
	background: ${token("color.background.warning")};
`;
const errorContentStyle = css`
	padding-left: ${token("space.200")};
`;

const Error = ({
	type,
	message,
}: {
	type: ErrorType,
	message: React.JSX.Element | string
}) => {
	const errorWrapperStyles = type === "warning" ? [errorWrapperStyle, errorWrapperWithWarningStyle] : [errorWrapperStyle];
	return (
		<div css={errorWrapperStyles}>
			{
				type === "warning" ? <WarningIcon label="warning" primaryColor={token("color.background.warning.bold")} size="medium" /> :
					<ErrorIcon label="warning" primaryColor={token("color.background.danger.bold")} size="medium" />
			}
			<div css={errorContentStyle}>{message}</div>
		</div>
	);
};

export default Error;

/** @jsxImportSource @emotion/react */
import { token } from "@atlaskit/tokens";
import { css } from "@emotion/react";

const containerStyle = css`
	width: 100%;
	border: ${token("space.025")} solid ${token("color.border")};
	border-radius: ${token("space.050")};
	padding: ${token("space.400")} 80px;
	box-sizing: border-box;
	background: transparent;
	margin: 0 0 ${token("space.100")};
`;
const headerStyle = css`
	line-height: ${token("space.400")};
	align-items: center;
`;
const stepTitleStyle = css`
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
		<div css={containerStyle}>
			<div css={headerStyle}>
				<div css={stepTitleStyle}>{title}</div>
			</div>
				<div data-testid="content">
					{children}
				</div>
		</div>
	);
};

export default Step;

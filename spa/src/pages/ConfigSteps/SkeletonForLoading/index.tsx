/** @jsxImportSource @emotion/react */
import Step from "../../../components/Step";
import Skeleton from "@atlaskit/skeleton";
import { css } from "@emotion/react";

const contentStyle = css`
	display: flex;
	align-items: center;
	justify-content: center;
	margin: 0 auto;
`;

const SkeletonForLoading = () => <>
	<Step
		title={<Skeleton
			width="60%"
			height="24px"
			borderRadius="5px"
			isShimmering
		/>}
	>
		<Skeleton
			width="100%"
			height="24px"
			borderRadius="5px"
			isShimmering
		/>
	</Step>
	<div css={contentStyle}>
		<Skeleton
			width="60%"
			height="24px"
			borderRadius="5px"
			isShimmering
		/>
	</div>
</>;

export default SkeletonForLoading;

import Step from "../../../components/Step";
import Skeleton from "@atlaskit/skeleton";
import styled from "@emotion/styled";

const Content = styled.div`
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
	<Content>
		<Skeleton
			width="60%"
			height="24px"
			borderRadius="5px"
			isShimmering
		/>
	</Content>
</>;

export default SkeletonForLoading;

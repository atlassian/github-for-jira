import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import styled from "@emotion/styled";
import CollapsibleStep from "../../components/CollapsibleStep";

const ConfigContainer = styled.div`
	max-width: 580px;
	margin: 0 auto;
`;

const ConfigSteps = () => {
	return (
		<Wrapper>
			<SyncHeader />
			<ConfigContainer>
				<CollapsibleStep
					step="1"
					title="Log in and authorize"
					canExpand={true}
					expanded={true}
				>
					<div>
						Content insideContent inside
						Content insideContent insideContent inside
						Content insideContent inside
						Content insideContent insideContent inside					Content insideContent inside
						Content insideContent insideContent inside					Content insideContent inside
						Content insideContent insideContent inside					Content insideContent inside
						Content insideContent insideContent inside					Content insideContent inside
						Content insideContent insideContent inside
					</div>
				</CollapsibleStep>
				<CollapsibleStep
					step="2"
					title="Connect your GitHub organization to Jira"
					canExpand={false}
					expanded={false}
				>
					<div>Content inside</div>
				</CollapsibleStep>

			</ConfigContainer>
		</Wrapper>
	);
};

export default ConfigSteps;

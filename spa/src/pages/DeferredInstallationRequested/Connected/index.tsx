import GithubConnectedHeader from "../../../components/GithubConnectedHeader";
import Step from "../../../components/Step";
import { Wrapper } from "../../../common/Wrapper";

const DeferredInstallationConnected = () => {

	return <>
		<Wrapper>
			<GithubConnectedHeader />
			<Step title="Connection is complete">
				<p>
					Let your Jira admin know that GitHub’s ready to use and your<br />
					team can use issue keys to link work to Jira.
				</p>
			</Step>
		</Wrapper>
	</>;
};

export default DeferredInstallationConnected;

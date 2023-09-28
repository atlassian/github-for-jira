import { useLocation } from "react-router-dom";
import SyncHeader from "../../../components/SyncHeader";
import GithubConnectedHeader from "../../../components/GithubConnectedHeader";
import Step from "../../../components/Step";
import { Wrapper } from "../../../common/Wrapper";

const DeferredInstallationConnected = () => {
	const { state } = useLocation();

	return <>
		<Wrapper>
			{
				state.successfulConnection ? <>
					<GithubConnectedHeader />
					<Step title="Connection is complete">
						<p>
							Let your Jira admin know that GitHub’s ready to use and your<br />
							team can use issue keys to link work to Jira.
						</p>
					</Step>
				</> : <>
					<SyncHeader />
					<Step title="You don't have owner permission">
						<p>
							Can’t connect ORG to JIRAHOST as you’re not the organisation’s owner.<br />
							An organization owner needs to complete connection,
							send them instructions on how to do this.
						</p>
					</Step>
				</>
			}
		</Wrapper>
	</>;
};

export default DeferredInstallationConnected;

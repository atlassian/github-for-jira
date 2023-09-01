import { useEffect, useState } from "react";
import { token } from "@atlaskit/tokens";
import ApiRequest from "../../api";
import styled from "@emotion/styled";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import GitHubConnectionOptions from "./GitHubConnectionOptions";
import GitHubCloudConnections from "./GitHubCloudConnections";
import GitHubEnterpriseConnections from "./GitHubEnterpriseConnections";
import { GHSUbscriptions } from "../../rest-interfaces";

const BackfillWrapper = styled(Wrapper)`
	width: 80%
`;

const Paragraph = styled.p`
	color: ${token("color.text.subtle")};
	margin-bottom: ${token("space.200")};
`;

const Header = styled.h3`
	margin-bottom: ${token("space.200")};
`;

const Connections = () => {
	const [ghSubscriptions, setSubscriptions] = useState<GHSUbscriptions | null>(
		null
	);
	const [selectedOption, setSelectedOption] = useState<number>(1);
	// const [isLoading, setIsLoading] = useState<boolean>(false);

	const fetchGHSubscriptions = async () => {
		try {
			// setIsLoading(true);
			const subs = await ApiRequest.subscriptions.getSubscriptions();
			setSubscriptions(subs.data);
			// setIsLoading(false);
		} catch (e) {
			console.log("Error -----> ", e);
		} finally {
			// setIsLoading(false);
		}
	};
	useEffect(() => {
		fetchGHSubscriptions();
	}, []);

	let ghCloudSubscriptions = null;
	let ghEnterpriseServers = null;
	if (ghSubscriptions) {
		ghCloudSubscriptions = ghSubscriptions.ghCloudSubscriptions;
		ghEnterpriseServers = ghSubscriptions.ghEnterpriseServers;
	}

	return (
		<BackfillWrapper>
			<SyncHeader />
			<Paragraph>
				Connecting GitHub to Jira allows you to view development activity in the
				context of your Jira project and issues. To send development data from
				GitHub to Jira, your team must include issue keys in branch names,
				commit messages, and pull request titles. Even if your organization is
				still backfilling historical data, you can start using issue keys in
				your development work immediately.
			</Paragraph>
			<GitHubConnectionOptions
				selectedOption={selectedOption}
				setSelectedOption={setSelectedOption}
			/>
			{selectedOption <= 2 && ghCloudSubscriptions && (
				<>
					<Header>GitHub Cloud</Header>
					<GitHubCloudConnections
						ghCloudSubscriptions={ghCloudSubscriptions}
					/>
				</>
			)}
			{(selectedOption === 1 || selectedOption === 3) && ghEnterpriseServers && (
				<>
					<Header>GitHub Enterprise Server</Header>
					<GitHubEnterpriseConnections
						ghEnterpriseServers={ghEnterpriseServers}
					/>
				</>
			)}
		</BackfillWrapper>
	);
};

export default Connections;

import { useEffect, useState } from "react";
import { token } from "@atlaskit/tokens";
import ApiRequest from "../../api";
import styled from "@emotion/styled";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import GitHubConnectionOptions from "./GitHubConnectionOptions";
import GitHubCloudConnections from "./GitHubCloudConnections";
import GitHubEnterpriseConnections from "./GitHubEnterpriseConnections";

const Paragraph = styled.p`
	color: ${token("color.text.subtle")};
	margin-bottom: ${token("space.200")};
`;

const Connections = () => {
	const [subscriptions, setSubscriptions] = useState([]);
	const [selectedOption, setSelectedOption] = useState<number>(1);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const fetchSubscriptions = async () => {
		try {
			setIsLoading(true);
			const subs = await ApiRequest.subscriptions.getSubscriptions();
			setSubscriptions(subs.data);
		} catch (e) {
			console.log("Error -----> ", e);
			console.log("Error -----> ", subscriptions);
		} finally {
			setIsLoading(false);
		}
	};
	useEffect(() => {
		fetchSubscriptions();
	}, []);
	return (
		<Wrapper>
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

			{selectedOption <= 2 && (
				<>
					<h3>GitHub Cloud</h3>
					<GitHubCloudConnections isLoading={isLoading} />
				</>
			)}
			{(selectedOption === 1 || selectedOption === 3) && (
				<>
					<h3>GitHub Enterprise Server</h3>
					<GitHubEnterpriseConnections isLoading={isLoading} />
				</>
			)}
		</Wrapper>
	);
};

export default Connections;

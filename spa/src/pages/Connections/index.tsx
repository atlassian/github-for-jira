import { useEffect, useState } from "react";
import { token } from "@atlaskit/tokens";
import ApiRequest from "../../api";
import styled from "@emotion/styled";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import GitHubCloudConnections from "./GitHubCloudConnections";
import GitHubEnterpriseConnections from "./GitHubEnterpriseConnections";
import { GHSUbscriptions } from "../../rest-interfaces";

const BackfillWrapper = styled(Wrapper)`
	width: 80%;
`;
const Header = styled.h3`
	margin-bottom: ${token("space.200")};
`;

const Connections = () => {
	const [ghSubscriptions, setSubscriptions] = useState<GHSUbscriptions | null>(
		null
	);
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
			{ghCloudSubscriptions && (
				<>
					<Header>GitHub Cloud</Header>
					<GitHubCloudConnections ghCloudSubscriptions={ghCloudSubscriptions} />
				</>
			)}
			{ghEnterpriseServers && (
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

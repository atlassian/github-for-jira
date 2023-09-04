import { useEffect, useState } from "react";
import { token } from "@atlaskit/tokens";
import ApiRequest from "../../api";
import styled from "@emotion/styled";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import GitHubCloudConnections from "./GHCloudConnections";
import GitHubEnterpriseConnections from "./GHEnterpriseConnections";
import { GHSUbscriptions } from "../../rest-interfaces";
import { reportError } from "../../utils";

const Header = styled.h3`
	margin-bottom: ${token("space.200")};
`;

const Connections = () => {
	const [ghSubscriptions, setSubscriptions] = useState<GHSUbscriptions | null>(
		null
	);
	const fetchGHSubscriptions = async () => {
		try {
			const subs = await ApiRequest.subscriptions.getSubscriptions();
			setSubscriptions(subs.data);
		} catch (e) {
			reportError(e, { path: "Fetching subscriptions" });
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
		<Wrapper>
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
					<GitHubEnterpriseConnections ghEnterpriseServers={ghEnterpriseServers} />
				</>
			)}
		</Wrapper>
	);
};

export default Connections;

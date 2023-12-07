import { useEffect, useState } from "react";
import ApiRequest from "../../api";
import SyncHeader from "../../components/SyncHeader";
import Step from "../../components/Step";
import { Wrapper } from "../../common/Wrapper";
import GitHubCloudConnections from "./GHCloudConnections";
import GitHubEnterpriseConnections from "./GHEnterpriseConnections";
import { GHSubscriptions } from "../../rest-interfaces";
import { reportError } from "../../utils";
import SkeletonForLoading from "./SkeletonForLoading";
import { useNavigate } from "react-router-dom";

const Connections = () => {
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [ghSubscriptions, setSubscriptions] = useState<GHSubscriptions | null>(null);
	const fetchGHSubscriptions = async () => {
		try {
			setIsLoading(true);
			const { data } = await ApiRequest.subscriptions.getSubscriptions();
			setSubscriptions(data);
		} catch (e) {
			reportError(e, { path: "Fetching subscriptions" });
		} finally {
			setIsLoading(false);
		}
	};
	useEffect(() => {
		fetchGHSubscriptions();
	}, []);

	// If there are no connections then go back to the start page
	useEffect(() => {
		if (!ghSubscriptions?.ghCloudSubscriptions && ghSubscriptions?.ghEnterpriseServers && ghSubscriptions.ghEnterpriseServers?.length === 0) {
			navigate("/spa");
		}
	}, [ghSubscriptions, navigate]);

	return (
		<Wrapper>
			<SyncHeader />
			{
				isLoading ? <SkeletonForLoading /> : <>
					{
						ghSubscriptions?.ghCloudSubscriptions && <Step title="GitHub Cloud">
							<GitHubCloudConnections ghCloudSubscriptions={ghSubscriptions.ghCloudSubscriptions} />
						</Step>
					}

					{
						ghSubscriptions?.ghEnterpriseServers && ghSubscriptions.ghEnterpriseServers?.length > 0 && <Step title="GitHub Enterprise Server">
							<GitHubEnterpriseConnections ghEnterpriseServers={ghSubscriptions.ghEnterpriseServers} />
						</Step>
					}
				</>
			}
		</Wrapper>
	);
};

export default Connections;
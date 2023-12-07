import { useEffect, useState } from "react";
import SyncHeader from "../../components/SyncHeader";
import Step from "../../components/Step";
import { Wrapper } from "../../common/Wrapper";
import GitHubCloudConnections from "./GHCloudConnections";
import GitHubEnterpriseConnections from "./GHEnterpriseConnections";
import { GHSubscriptions } from "../../rest-interfaces";
import SkeletonForLoading from "./SkeletonForLoading";
import { useNavigate } from "react-router-dom";
import SubscriptionManager from "../../services/subscription-manager";
import { AxiosError } from "axios";

const Connections = () => {
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [subscriptions, setSubscriptions] = useState<GHSubscriptions | null>(null);
	const fetchGHSubscriptions = async () => {
		setIsLoading(true);
		const response = await SubscriptionManager.getSubscriptions();
		if (response instanceof AxiosError) {
			// TODO: Handle the error once we have the designs
			console.error("Error", response);
		}
		setSubscriptions(response as GHSubscriptions);
		setIsLoading(false);
	};
	useEffect(() => {
		fetchGHSubscriptions();
	}, []);

	// If there are no connections then go back to the start page
	useEffect(() => {
		if (!subscriptions?.ghCloudSubscriptions && subscriptions?.ghEnterpriseServers && subscriptions.ghEnterpriseServers?.length === 0) {
			navigate("/spa");
		}
	}, [subscriptions, navigate]);

	return (
		<Wrapper>
			<SyncHeader />
			{
				isLoading ? <SkeletonForLoading /> : <>
					{
						subscriptions?.ghCloudSubscriptions && <Step title="GitHub Cloud">
							<GitHubCloudConnections ghCloudSubscriptions={subscriptions.ghCloudSubscriptions} />
						</Step>
					}

					{
						subscriptions?.ghEnterpriseServers && subscriptions.ghEnterpriseServers?.length > 0 && <Step title="GitHub Enterprise Server">
							<GitHubEnterpriseConnections ghEnterpriseServers={subscriptions.ghEnterpriseServers} />
						</Step>
					}
				</>
			}
		</Wrapper>
	);
};

export default Connections;

import { useEffect, useState } from "react";
import { ModalTransition } from "@atlaskit/modal-dialog";
import { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import SyncHeader from "../../components/SyncHeader";
import Step from "../../components/Step";
import { Wrapper } from "../../common/Wrapper";
import GitHubCloudConnections from "./GHCloudConnections";
import GitHubEnterpriseConnections from "./GHEnterpriseConnections";
import {
	GHSubscriptions,
	BackfillPageModalTypes,
	SuccessfulConnection,
	GitHubEnterpriseApplication,
} from "../../rest-interfaces";
import SkeletonForLoading from "./SkeletonForLoading";
import SubscriptionManager from "../../services/subscription-manager";
import RestartBackfillModal from "./Modals/RestartBackfillModal";
import DisconnectSubscriptionModal from "./Modals/DisconnectSubscriptionModal";
import { DisconnectGHEServerModal, DeleteAppsInGitHubModal } from "./Modals/DisconnectGHEServerModal";

const hasGHCloudConnections = (subscriptions: GHSubscriptions): boolean =>
	subscriptions?.ghCloudSubscriptions &&
	subscriptions?.ghCloudSubscriptions?.successfulCloudConnections &&
	subscriptions?.ghCloudSubscriptions?.successfulCloudConnections.length > 0;

const Connections = () => {
	const navigate = useNavigate();
	//////////
	const [isModalOpened, setIsModalOpened] = useState(false);
	const [selectedModal, setSelectedModal] =
		useState<BackfillPageModalTypes>("BACKFILL");
	const [dataForModal, setDataForModal] = useState<
		SuccessfulConnection | GitHubEnterpriseApplication | undefined
	>(undefined);
	const openedModal = () => {
		switch (selectedModal) {
			case "BACKFILL":
				return (
					<RestartBackfillModal
						subscription={dataForModal as SuccessfulConnection}
						setIsModalOpened={setIsModalOpened}
						refetch={fetchGHSubscriptions}
					/>
				);
			case "DISCONNECT_SUBSCRIPTION":
				return (
					<DisconnectSubscriptionModal
						subscription={dataForModal as SuccessfulConnection}
						setIsModalOpened={setIsModalOpened}
						refetch={fetchGHSubscriptions}
					/>
				);
			// 	TODO: Create modals for GHE later
			case "DISCONNECT_SERVER":
				return (
					<DisconnectGHEServerModal
						gheServer={dataForModal as GitHubEnterpriseApplication}
						setIsModalOpened={setIsModalOpened}
						setSelectedModal={setSelectedModal}
					/>
				);
			case "DELETE_GHE_APP":
				return (
					<DeleteAppsInGitHubModal
						gheServer={dataForModal as GitHubEnterpriseApplication}
						setIsModalOpened={setIsModalOpened}
						refetch={fetchGHSubscriptions}
					/>
				);
			case "DISCONNECT_SERVER_APP":
			default:
				return <></>;
		}
	};
	//////////
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [subscriptions, setSubscriptions] = useState<GHSubscriptions | null>(
		null
	);
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
		if (
			!subscriptions?.ghCloudSubscriptions &&
			subscriptions?.ghEnterpriseServers &&
			subscriptions.ghEnterpriseServers?.length === 0
		) {
			navigate("/spa");
		}
	}, [subscriptions, navigate]);

	return (
		<Wrapper width="90%">
			<SyncHeader />
			{isLoading ? (
				<SkeletonForLoading />
			) : (
				<>
					{subscriptions && hasGHCloudConnections(subscriptions) && (
						<Step title="GitHub Cloud">
							<GitHubCloudConnections
								setIsModalOpened={setIsModalOpened}
								setSelectedModal={setSelectedModal}
								ghCloudSubscriptions={subscriptions.ghCloudSubscriptions}
								setDataForModal={setDataForModal}
							/>
						</Step>
					)}

					{subscriptions?.ghEnterpriseServers &&
						subscriptions.ghEnterpriseServers?.length > 0 && (
							<Step title="GitHub Enterprise Server">
								<GitHubEnterpriseConnections
									ghEnterpriseServers={subscriptions.ghEnterpriseServers}
									setIsModalOpened={setIsModalOpened}
									setSelectedModal={setSelectedModal}
									setDataForModal={setDataForModal}
								/>
							</Step>
						)}
					<ModalTransition>
						{isModalOpened && dataForModal && openedModal()}
					</ModalTransition>
				</>
			)}
		</Wrapper>
	);
};

export default Connections;

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
	GitHubEnterpriseApplication
} from "../../rest-interfaces";
import SkeletonForLoading from "./SkeletonForLoading";
import SubscriptionManager from "../../services/subscription-manager";
import RestartBackfillModal from "./Modals/RestartBackfillModal";
import DisconnectSubscriptionModal from "./Modals/DisconnectSubscriptionModal";
import {
	DisconnectGHEServerModal,
	DeleteAppInGitHubModal,
	DisconnectGHEServerAppModal,
} from "./Modals/DisconnectGHEServerModal";
import { getInProgressSubIds, getUpdatedSubscriptions } from "~/src/utils";

const hasGHCloudConnections = (subscriptions: GHSubscriptions): boolean =>
	subscriptions?.ghCloudSubscriptions &&
	subscriptions?.ghCloudSubscriptions?.successfulCloudConnections &&
	subscriptions?.ghCloudSubscriptions?.successfulCloudConnections.length > 0;

const Connections = () => {
	const navigate = useNavigate();

	const [isModalOpened, setIsModalOpened] = useState(false);
	const [selectedModal, setSelectedModal] =
		useState<BackfillPageModalTypes>("BACKFILL");
	const [dataForModal, setDataForModal] = useState<
		SuccessfulConnection | GitHubEnterpriseApplication | undefined
	>(undefined);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [subscriptions, setSubscriptions] = useState<GHSubscriptions | null>(
		null
	);
	const [inProgressSubs, setInProgressSubs] = useState<Array<number> | null>(
		null
	);
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
					<DeleteAppInGitHubModal
						gheServer={dataForModal as GitHubEnterpriseApplication}
						setIsModalOpened={setIsModalOpened}
						refetch={fetchGHSubscriptions}
					/>
				);
			case "DISCONNECT_SERVER_APP":
				return (
					<DisconnectGHEServerAppModal
						gheServer={dataForModal as GitHubEnterpriseApplication}
						setIsModalOpened={setIsModalOpened}
						setSelectedModal={setSelectedModal}
					/>
				);
			default:
				return <></>;
		}
	};

	const fetchGHSubscriptions = async () => {
		try {
			setIsLoading(true);
			const response = await SubscriptionManager.getSubscriptions();
			if (response instanceof AxiosError) {
				// TODO: Handle the error once we have the designs
				console.error("Error", response);
			} else {
				const inProgressSubIds = getInProgressSubIds(response);
				if (inProgressSubIds && inProgressSubIds.length > 0) {
					setInProgressSubs(inProgressSubIds);
				}
				setSubscriptions(response as GHSubscriptions);
			}
		} catch (e) {
			// TODO: handle this error in UI/Modal ?
			console.error("Could not fetch ghe subscriptions: ", e);
		} finally {
			setIsLoading(false);
		}
	};

	const fetchBackfillStatus = async (inProgressSubs: Array<number>) => {
		try {
			const response = await SubscriptionManager.getSubscriptionsBackfillStatus(
				inProgressSubs.toString()
			);
			if (response instanceof AxiosError) {
				// TODO: Handle the error once we have the designs
				console.error("Error", response);
			} else {
				if(subscriptions){
					const newSubscriptions = getUpdatedSubscriptions(response, subscriptions);
					if(newSubscriptions) {
						setSubscriptions(newSubscriptions);
					}
				}
				if (!response.isBackfillComplete) {
					setTimeout(() => {
						fetchBackfillStatus(inProgressSubs);
					}, 3000);
				}
			}
		} catch (e) {
			// TODO: handle this error in UI/Modal ?
			console.error("Could not fetch ghe subscriptions: ", e);
		}
	};

	useEffect(() => {
		if (inProgressSubs && inProgressSubs.length > 0) {
			fetchBackfillStatus(inProgressSubs);
		}
	}, [inProgressSubs]);

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
									setIsLoading={setIsLoading}
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

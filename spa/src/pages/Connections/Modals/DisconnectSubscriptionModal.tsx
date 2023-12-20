import { useState } from "react";
import { AxiosError } from "axios";
import Modal, {
	ModalBody,
	ModalFooter,
	ModalHeader,
	ModalTitle,
} from "@atlaskit/modal-dialog";
import Button, { LoadingButton } from "@atlaskit/button";
import { SuccessfulConnection } from "../../../../../src/rest-interfaces";
import SubscriptionManager from "../../../services/subscription-manager";

/**
 * NOTE: While testing in dev mode, please disable the React.StrictMode first,
 * otherwise this modal won't show up.
 */
const DisconnectSubscriptionModal = ({
	subscription,
	setIsModalOpened,
	refetch,
}: {
	subscription: SuccessfulConnection;
	setIsModalOpened: (x: boolean) => void;
	refetch: () => void;
}) => {
	const [isLoading, setIsLoading] = useState<boolean>(false);

	const disconnect = async () => {
		setIsLoading(true);
		const response: boolean | AxiosError =
			await SubscriptionManager.deleteSubscription(subscription.subscriptionId);
		if (response instanceof AxiosError) {
			// TODO: Handle the error once we have the designs
			console.error("Error", response);
		} else {
			await refetch();
		}
		setIsModalOpened(false);
	};

	return (
		<Modal onClose={() => setIsModalOpened(false)}>
			<ModalHeader>
				<ModalTitle appearance="warning">
					<>Disconnect {subscription.account.login}?</>
				</ModalTitle>
			</ModalHeader>
			<ModalBody>
				<p data-testid="disconnect-content">
					Are you sure you want to disconnect your organization{" "}
					<b>{subscription.account.login}</b>? This means that you will have to
					redo the backfill of historical data if you ever want to reconnect
				</p>
			</ModalBody>
			<ModalFooter>
				<Button
					isDisabled={isLoading}
					appearance="subtle"
					onClick={() => setIsModalOpened(false)}
				>
					Cancel
				</Button>
				{isLoading ? (
					<LoadingButton style={{ width: 80 }} isLoading>
						Loading button
					</LoadingButton>
				) : (
					<Button appearance="danger" onClick={disconnect}>
						Disconnect
					</Button>
				)}
			</ModalFooter>
		</Modal>
	);
};

export default DisconnectSubscriptionModal;

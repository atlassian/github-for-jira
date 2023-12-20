import { useState } from "react";
import { AxiosError } from "axios";
import Modal, {
	ModalBody,
	ModalFooter,
	ModalHeader,
	ModalTitle,
} from "@atlaskit/modal-dialog";
import Button, { LoadingButton } from "@atlaskit/button";
import { BackfillPageModalTypes, GitHubEnterpriseApplication } from "../../../../../src/rest-interfaces";
import SubscriptionManager from "../../../services/subscription-manager";

/**
 * NOTE: While testing in dev mode, please disable the React.StrictMode first,
 * otherwise this modal won't show up.
 */
const DisconnectGHEServerModal = ({
	gheServer,
	setIsModalOpened,
    setSelectedModal,
}: {
	gheServer: GitHubEnterpriseApplication;
	setIsModalOpened: (x: boolean) => void;
    setSelectedModal: (selectedModal:BackfillPageModalTypes) => void;
}) => {
	const [isLoading, setIsLoading] = useState<boolean>(false);

	const disconnect = async () => {
		setIsLoading(true);
		const response: boolean | AxiosError =
			await SubscriptionManager.deleteGHEServer(gheServer.uuid);
		if (response instanceof AxiosError) {
			// TODO: Handle the error once we have the designs
			console.error("Error", response);
		} else {
			setSelectedModal("DELETE_GHE_APP");
		}
	};

	return (
		<Modal onClose={() => setIsModalOpened(false)}>
			<ModalHeader>
				<ModalTitle appearance="warning">
					Are you sure you want to disconnect this server?
				</ModalTitle>
			</ModalHeader>
			<ModalBody>
				<p data-testid="disconnect-content">
					To reconnect this server, you'll need to create new GitHub apps and
					import data about its organizations and repositories again.
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

const DeleteAppsInGitHubModal = ({
	gheServer,
	setIsModalOpened,
	refetch,
}: {
	gheServer: GitHubEnterpriseApplication;
	setIsModalOpened: (x: boolean) => void;
	refetch: () => void;
}) => {
    const { gitHubAppName, gitHubBaseUrl } = gheServer;
	return (
		<Modal onClose={() => setIsModalOpened(false)}>
			<ModalHeader><b>Server disconnected</b></ModalHeader>
			<ModalBody>
				<p data-testid="disconnect-content">
					You can now delete these unused apps from your GitHub server. Select
					the app, then in GitHub select <b>Delete GitHub app</b>.
				</p>
                <ul>
                    <li><a target="_blank" href={`${gitHubBaseUrl}/settings/apps/${gitHubAppName}/advanced`}>{gheServer.gitHubAppName}</a></li>
                </ul>
			</ModalBody>
			<ModalFooter>
				<Button
					appearance="primary"
					onClick={() => {
						setIsModalOpened(false);
						refetch();
					}}
				>
					Close
				</Button>
			</ModalFooter>
		</Modal>
	);
};

export { DisconnectGHEServerModal, DeleteAppsInGitHubModal };

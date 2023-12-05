import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle } from "@atlaskit/modal-dialog";
import Button from "@atlaskit/button";
import { SuccessfulConnection } from "../../../../../src/rest-interfaces";

/**
 * NOTE: While testing in dev mode, please disable the React.StrictMode first,
 * otherwise this modal won't show up.
 */
const RestartBackfillModal = ({ subscription, setIsModalOpened }: {
	subscription: SuccessfulConnection,
	setIsModalOpened: (x: boolean) => void
}) => {
	const backfill = () => {
		// TODO: API call to disconnect this subscription
		console.log("Backfill for", subscription.account.login);
		setIsModalOpened(false);
	};

	return (
		<>
			<Modal onClose={() => setIsModalOpened(false)}>
				<ModalHeader>
					<ModalTitle appearance="warning">Backfill your data</ModalTitle>
				</ModalHeader>
				<ModalBody>
					<p>
						Backfilling data can take a long time, so we’ll only backfill your data from the last 6 months.
						If you want to backfill more data, choose a date below. Branches will be backfilled regardless of their age.
					</p>
				</ModalBody>
				<ModalFooter>
					<Button appearance="subtle" onClick={() => setIsModalOpened(false)}>Cancel</Button>
					<Button appearance="danger" onClick={backfill}>
						Backfill data
					</Button>
				</ModalFooter>
			</Modal>
		</>
	);
};

export default  RestartBackfillModal;

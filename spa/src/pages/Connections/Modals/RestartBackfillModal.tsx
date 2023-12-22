import { useEffect, useState } from "react";
import Modal, {
	ModalBody,
	ModalFooter,
	ModalHeader,
	ModalTitle,
} from "@atlaskit/modal-dialog";
import Button from "@atlaskit/button";
import { SuccessfulConnection } from "../../../../../src/rest-interfaces";
import { Checkbox } from "@atlaskit/checkbox";
import { Label } from "@atlaskit/form";
import { DatePicker } from "@atlaskit/datetime-picker";
import { AxiosError } from "axios";
import SubscriptionManager from "../../../services/subscription-manager";

/**
 * NOTE: While testing in dev mode, please disable the React.StrictMode first,
 * otherwise this modal won't show up.
 */
const RestartBackfillModal = ({
	subscription,
	setIsModalOpened,
	refetch,
}: {
	subscription: SuccessfulConnection;
	setIsModalOpened: (x: boolean) => void;
	refetch: () => void;
}) => {
	const [restartFromDateCheck, setRestartFromDateCheck] = useState(false);
	const [backfillDate, setBackfillDate] = useState("");

	/**
	 * TODO: Remove this later once the issue within datepicker is identified and fixed
	 * Thread: https://atlassian.slack.com/archives/CFJ9DU39U/p1701912243843529
	 *
	 * The datepicker jumps around when rendered inside a modal,
	 * Until that is fixed, adding a short disable for the datepicker,
	 * which is then enabled to avoid having the jumpy effect.
	 */
	const [isDisabled, setIsDisabled] = useState(true);
	useEffect(() => {
		setTimeout(() => setIsDisabled(false), 10);
	}, []);

	const backfill = async () => {
		// TODO: API call to disconnect this subscription
		const syncType = restartFromDateCheck ? "full" : "";
		const response = await SubscriptionManager.syncSubscription(
			subscription.subscriptionId,
			{ syncType, source: "backfill-button", commitsFromDate: backfillDate }
		);
		if (response instanceof AxiosError) {
			// TODO: Handle the error once we have the designs
			console.error("Error", response);
		}
		await refetch();
		setIsModalOpened(false);
	};

	return (
		<Modal onClose={() => setIsModalOpened(false)}>
			<ModalHeader>
				<ModalTitle>Backfill your data</ModalTitle>
			</ModalHeader>
			<ModalBody>
				<p>
					Backfilling data can take a long time, so we’ll only backfill your
					data from the last 6 months. If you want to backfill more data, choose
					a date below. Branches will be backfilled regardless of their age.
				</p>
				<Label htmlFor="backfill-date-picker">Choose date</Label>
				<DatePicker
					testId="backfill-datepicker"
					selectProps={{
						inputId: "backfill-date-picker",
					}}
					placeholder="Select date"
					isDisabled={isDisabled} // TODO: remove this later
					onChange={setBackfillDate}
				/>
				<Checkbox
					onChange={() => setRestartFromDateCheck(!restartFromDateCheck)}
					label={`Restart the backfill from today to this date`}
					name="restart-from-selected-date"
				/>
			</ModalBody>
			<ModalFooter>
				<Button appearance="subtle" onClick={() => setIsModalOpened(false)}>
					Cancel
				</Button>
				<Button appearance="danger" onClick={backfill}>
					Backfill data
				</Button>
			</ModalFooter>
		</Modal>
	);
};

export default RestartBackfillModal;

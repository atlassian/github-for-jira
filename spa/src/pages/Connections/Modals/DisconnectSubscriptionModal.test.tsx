import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import DisconnectSubscriptionModal from "./DisconnectSubscriptionModal";
import SubscriptionManager from "../../../services/subscription-manager";

jest.mock("../../../services/subscription-manager");

const sampleSubscription = {
	app_slug: "string",
	syncWarning: "warning",
	id: 1,
	account:  {
		login: "sample",
		id: 1,
		avatar_url: "string",
	},
	repository_selection: "string",
	app_id: 1,
	target_id: 1,
	target_type: "string",
	created_at: "string",
	updated_at: "string",
	syncStatus: "string",
	totalNumberOfRepos: 2,
	numberOfSyncedRepos: 2,
	jiraHost: "https://test-jira.atlassian.net",
	isGlobalInstall: true,
	backfillSince: null,
	subscriptionId: 1,
	html_url: "html_url"
};
const isModalOpened = jest.fn();
const refetch = jest.fn();

test("Clicking cancel in disconnect subscription Modal", async () => {
	render(
		<BrowserRouter>
			<DisconnectSubscriptionModal subscription={sampleSubscription} setIsModalOpened={isModalOpened} refetch={refetch} />
		</BrowserRouter>
	);

	expect(screen.getByText("Disconnect sample?")).toBeInTheDocument();
	const text = screen.getByTestId("disconnect-content");
	expect(text.textContent).toBe("Are you sure you want to disconnect your organization sample? This means that you will have to redo the backfill of historical data if you ever want to reconnect");

	await userEvent.click(screen.getByText("Cancel"));
	expect(isModalOpened).toBeCalled();
	expect(refetch).not.toBeCalled();
});

test("Clicking Disconnect in disconnect subscription Modal", async () => {
	jest.mocked(SubscriptionManager).deleteSubscription = jest.fn().mockReturnValue(Promise.resolve(true));

	render(
		<BrowserRouter>
			<DisconnectSubscriptionModal subscription={sampleSubscription} setIsModalOpened={isModalOpened} refetch={refetch} />
		</BrowserRouter>
	);

	expect(screen.getByText("Disconnect sample?")).toBeInTheDocument();
	const text = screen.getByTestId("disconnect-content");
	expect(text.textContent).toBe("Are you sure you want to disconnect your organization sample? This means that you will have to redo the backfill of historical data if you ever want to reconnect");

	await userEvent.click(screen.getByText("Disconnect"));
	/**
	 * Called twice, once when the loading is set to true,
	 * and later after getting the response from the API request
	 */
	expect(isModalOpened).toBeCalledTimes(2);
	expect(refetch).toBeCalled();
});

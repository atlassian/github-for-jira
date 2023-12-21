import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { DisconnectGHEServerModal } from "./DisconnectGHEServerModal";
import SubscriptionManager from "../../../services/subscription-manager";

jest.mock("../../../services/subscription-manager");

const sampleGHEServer = {
	id: 12344,
	uuid: "1hsjhg-2hjgej2-ushjsjs-97b2n",
	appId: 1,
	gitHubBaseUrl: "string",
	gitHubClientId: "string",
	gitHubAppName: "string",
	installationId: 2,
	createdAt: "string",
	updatedAt: "string",
	successfulConnections: [],
	failedConnections: [],
	installations: {
		fulfilled: [],
		rejected: [],
		total: 1,
	},
};
const isModalOpened = jest.fn();
const setSelectedModal = jest.fn();
const refetch = jest.fn();

test("Clicking cancel in disconnect subscription Modal", async () => {
	render(
		<BrowserRouter>
			<DisconnectGHEServerModal
				gheServer={sampleGHEServer}
				setIsModalOpened={isModalOpened}
				setSelectedModal={setSelectedModal}
			/>
		</BrowserRouter>
	);

	expect(
		screen.getByText("Are you sure you want to disconnect this server?")
	).toBeInTheDocument();
	const text = screen.getByTestId("disconnect-content");
	expect(text.textContent).toBe(
		"To reconnect this server, you'll need to create new GitHub apps and import data about its organizations and repositories again."
	);

	await userEvent.click(screen.getByText("Cancel"));
	expect(isModalOpened).toBeCalled();
	expect(refetch).not.toBeCalled();
});

test("Clicking Disconnect in disconnect subscription Modal", async () => {
	jest.mocked(SubscriptionManager).deleteSubscription = jest
		.fn()
		.mockReturnValue(Promise.resolve(true));

	render(
		<BrowserRouter>
			<DisconnectGHEServerModal
				gheServer={sampleGHEServer}
				setIsModalOpened={isModalOpened}
				setSelectedModal={setSelectedModal}
			/>
		</BrowserRouter>
	);

	expect(
		screen.getByText("Are you sure you want to disconnect this server?")
	).toBeInTheDocument();
	const text = screen.getByTestId("disconnect-content");
	expect(text.textContent).toBe(
		"To reconnect this server, you'll need to create new GitHub apps and import data about its organizations and repositories again."
	);

	await userEvent.click(screen.getByText("Disconnect"));
	/**
	 * Called twice, once when the loading is set to true,
	 * and later after getting the response from the API request
	 */
	expect(isModalOpened).toBeCalledTimes(1);
	expect(refetch).toBeCalled();
});

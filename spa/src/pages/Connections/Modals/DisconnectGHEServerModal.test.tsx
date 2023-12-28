import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import {
	DisconnectGHEServerModal,
	DeleteAppInGitHubModal,
	DisconnectGHEServerAppModal
} from "./DisconnectGHEServerModal";
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

test("Clicking cancel in disconnect GHE App Modal", async () => {
	render(
		<BrowserRouter>
			<DisconnectGHEServerAppModal
				gheServer={sampleGHEServer}
				setIsModalOpened={isModalOpened}
				setSelectedModal={setSelectedModal}
			/>
		</BrowserRouter>
	);

	expect(
		screen.getByText("Are you sure you want to disconnect this app?")
	).toBeInTheDocument();
	const text = screen.getByTestId("disconnect-content");
	expect(text.textContent).toBe(
		"To reconnect this app, you'll need to recreate it and import data about its organizations and repositories again."
	);

	await userEvent.click(screen.getByText("Cancel"));
	expect(isModalOpened).toBeCalled();
});

test("Clicking Disconnect in disconnect GHE App Modal", async () => {
	jest.mocked(SubscriptionManager).deleteSubscription = jest
		.fn()
		.mockReturnValue(Promise.resolve(true));

	render(
		<BrowserRouter>
			<DisconnectGHEServerAppModal
				gheServer={sampleGHEServer}
				setIsModalOpened={isModalOpened}
				setSelectedModal={setSelectedModal}
			/>
		</BrowserRouter>
	);

	expect(
		screen.getByText("Are you sure you want to disconnect this app?")
	).toBeInTheDocument();
	const text = screen.getByTestId("disconnect-content");
	expect(text.textContent).toBe(
		"To reconnect this app, you'll need to recreate it and import data about its organizations and repositories again."
	);

	await userEvent.click(screen.getByText("Disconnect"));
	/**
	 * Called twice, once when the loading is set to true,
	 * and later after getting the response from the API request
	 */
	expect(setSelectedModal).toBeCalledTimes(1);
});

test("Clicking cancel in disconnect GHE server Modal", async () => {
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
});

test("Clicking Disconnect in disconnect GHE server Modal", async () => {
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
	expect(setSelectedModal).toBeCalledTimes(2);
});

test("Clicking cancel in disconnect GHE server Modal", async () => {
	render(
		<BrowserRouter>
			<DeleteAppInGitHubModal
				gheServer={sampleGHEServer}
				setIsModalOpened={isModalOpened}
				refetch={refetch}
			/>
		</BrowserRouter>
	);

	expect(screen.getByText("Server disconnected")).toBeInTheDocument();
	const text = screen.getByTestId("disconnect-content");
	expect(text.textContent).toBe(
		"You can now delete these unused apps from your GitHub server. Select the app, then in GitHub select Delete GitHub app."
	);

	await userEvent.click(screen.getByText("Close"));
	expect(isModalOpened).toBeCalled();
	expect(refetch).toBeCalled();
});

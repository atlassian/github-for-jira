import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import ConfigSteps from "./index";
import OAuthManager from "../../services/oauth-manager";
import AppManager from "../../services/app-manager";

jest.mock("../../services/oauth-manager");
jest.mock("../../services/app-manager");

/* eslint-disable react-refresh/only-export-components */
const Authenticated = {
	checkValidity: jest.fn().mockReturnValue(Promise.resolve(true)),
	authenticateInGitHub: jest.fn().mockReturnValue(Promise),
	fetchOrgs: jest.fn().mockReturnValue({ orgs: []}),
	setTokens: jest.fn(),
	getUserDetails: jest.fn().mockReturnValue({ username: "kay", email: "kay"}),
	clear: jest.fn(),
};

/* eslint-disable react-refresh/only-export-components */
const UnAuthenticated = {
	checkValidity: jest.fn().mockReturnValue(Promise.resolve(false)),
	authenticateInGitHub: jest.fn().mockReturnValue(Promise),
	fetchOrgs: jest.fn().mockReturnValue({ orgs: []}),
	setTokens: jest.fn(),
	getUserDetails: jest.fn().mockReturnValue({ username: "", email: ""}),
	clear: jest.fn(),
};

// Mocking the global variable
/* eslint-disable @typescript-eslint/no-explicit-any*/
(global as any).AP = {
	getLocation: jest.fn(),
	context: {
		getContext: jest.fn(),
		getToken: jest.fn()
	},
	navigator: {
		go: jest.fn(),
		reload: jest.fn()
	}
};
window.open = jest.fn();

test("Connect GitHub Screen - Initial Loading of the page when not authenticated", async () => {

	jest.mocked(OAuthManager).getUserDetails = UnAuthenticated.getUserDetails;
	jest.mocked(OAuthManager).checkValidity = UnAuthenticated.checkValidity;

	await act(async () => {
		render(
			<BrowserRouter>
				<ConfigSteps />
			</BrowserRouter>
		);
	});

	expect(screen.queryByText("Connect Github to Jira")).toBeInTheDocument();
	expect(screen.queryByText("GitHub Cloud")).toBeInTheDocument();
	expect(screen.queryByText("GitHub Enterprise Server")).toBeInTheDocument();
	expect(screen.queryByText("Connect your GitHub organization to Jira")).toBeInTheDocument();
	expect(screen.queryByRole("button", { name: "Authorize in GitHub" })).toHaveTextContent("Authorize in GitHub");
});

test("Connect GitHub Screen - Checking the GitHub Enterprise flow when not authenticated", async () => {

	jest.mocked(OAuthManager).getUserDetails = UnAuthenticated.getUserDetails;
	jest.mocked(OAuthManager).checkValidity = UnAuthenticated.checkValidity;

	await act(async () => {
		render(
			<BrowserRouter>
				<ConfigSteps />
			</BrowserRouter>
		);
	});

	await act(() => userEvent.click(screen.getByText("GitHub Enterprise Server")));
	await act(() => userEvent.click(screen.getByText("Authorize in GitHub")));

	expect(AP.getLocation).toHaveBeenCalled();
});

test("Connect GitHub Screen - Checking the GitHub Cloud flow when not authenticated", async () => {

	jest.mocked(OAuthManager).getUserDetails = UnAuthenticated.getUserDetails;
	jest.mocked(OAuthManager).checkValidity = UnAuthenticated.checkValidity;
	jest.mocked(OAuthManager).authenticateInGitHub = UnAuthenticated.authenticateInGitHub;

	await act(async () => {
		render(
			<BrowserRouter>
				<ConfigSteps />
			</BrowserRouter>
		);
	});

	await act(() => userEvent.click(screen.getByText("GitHub Cloud")));
	await act(() => userEvent.click(screen.getByText("Authorize in GitHub")));

	expect(OAuthManager.authenticateInGitHub).toHaveBeenCalled();
});

test("Connect GitHub Screen - Checking the GitHub Cloud flow when authenticated", async () => {

	jest.mocked(OAuthManager).getUserDetails = Authenticated.getUserDetails;
	jest.mocked(OAuthManager).checkValidity = Authenticated.checkValidity;
	jest.mocked(AppManager).fetchOrgs = Authenticated.fetchOrgs;

	await act(async () => {
		render(
			<BrowserRouter>
				<ConfigSteps />
			</BrowserRouter>
		);
	});

	expect(screen.queryByText("GitHub Cloud")).not.toBeInTheDocument();
	expect(screen.queryByText("GitHub Enterprise Server")).not.toBeInTheDocument();
	expect(screen.queryByText("Authorize in GitHub")).not.toBeInTheDocument();
	expect(screen.queryByText("Log in and authorize")).toBeInTheDocument();
});

test("Connect GitHub Screen - Changing GitHub login when authenticated", async () => {

	jest.mocked(OAuthManager).getUserDetails = Authenticated.getUserDetails;
	jest.mocked(OAuthManager).checkValidity = Authenticated.checkValidity;
	jest.mocked(AppManager).fetchOrgs = Authenticated.fetchOrgs;

	await act(async () => {
		render(
			<BrowserRouter>
				<ConfigSteps />
			</BrowserRouter>
		);
	});

	await act(() => userEvent.click(screen.getByText("Log in and authorize")));

	expect(screen.queryByText("Change GitHub login")).toBeInTheDocument();

	await act(() => userEvent.click(screen.getByText("Change GitHub login")));

	expect(window.open).toHaveBeenCalled();

	expect(screen.queryByText("GitHub Cloud")).toBeInTheDocument();
	expect(screen.queryByText("GitHub Enterprise Server")).toBeInTheDocument();
	expect(screen.queryByText("Authorize in GitHub")).toBeInTheDocument();
});


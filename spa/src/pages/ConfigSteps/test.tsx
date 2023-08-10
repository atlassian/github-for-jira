import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import ConfigSteps from "./index";
import OAuthManager from "../../services/oauth-manager";
import AppManager from "../../services/app-manager";

jest.mock("../../services/oauth-manager");
jest.mock("../../services/app-manager");
jest.mock("react-router-dom", () => ({
	...jest.requireActual("react-router-dom"),
	useNavigate: () => jest.fn(),
}));

/* eslint-disable react-refresh/only-export-components */
const Authenticated = {
	checkValidity: jest.fn().mockReturnValue(Promise.resolve(true)),
	authenticateInGitHub: jest.fn().mockReturnValue(Promise),
	fetchOrgs: jest.fn().mockReturnValue({ orgs: [ { account: { login: "org-1" }, id: 1 }, { account: { login: "org-2" }, id: 2 }, { account: { login: "org-3" }, id: 3  } ]}),
	installNewApp: jest.fn(),
	connectOrg: jest.fn(),
	setTokens: jest.fn(),
	getUserDetails: jest.fn().mockReturnValue({ username: "kay", email: "kay"}),
	clear: jest.fn(),
};
const AuthenticatedWithNoOrgs = {
	checkValidity: jest.fn().mockReturnValue(Promise.resolve(true)),
	authenticateInGitHub: jest.fn().mockReturnValue(Promise),
	fetchOrgs: jest.fn().mockReturnValue({ orgs: [] }),
	installNewApp: jest.fn(),
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
	expect(screen.queryByText("Select your GitHub product")).toBeInTheDocument();
	expect(screen.queryByRole("button", { name: "Get started" })).toHaveTextContent("Get started");
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
	await act(() => userEvent.click(screen.getByText("Get started")));

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
	await act(() => userEvent.click(screen.getByText("Get started")));

	expect(OAuthManager.authenticateInGitHub).toHaveBeenCalled();
});

test("Connect GitHub Screen - Checking the GitHub Cloud flow when authenticated with orgs", async () => {
	jest.mocked(OAuthManager).getUserDetails = Authenticated.getUserDetails;
	jest.mocked(OAuthManager).checkValidity = Authenticated.checkValidity;
	jest.mocked(AppManager).fetchOrgs = Authenticated.fetchOrgs;
	jest.mocked(AppManager).installNewApp = Authenticated.installNewApp;
	jest.mocked(AppManager).connectOrg = jest.fn().mockImplementation(async () => {
		//do not return, so that to assert on the loading icon
		return new Promise(_ => {});
	});

	await act(async () => {
		render(
			<BrowserRouter>
				<ConfigSteps />
			</BrowserRouter>
		);
	});

	expect(screen.queryByText("GitHub Cloud")).not.toBeInTheDocument();
	expect(screen.queryByText("GitHub Enterprise Server")).not.toBeInTheDocument();
	expect(screen.queryByText("Get started")).not.toBeInTheDocument();
	expect(screen.queryByText("Select your GitHub product")).not.toBeInTheDocument();

	// Checking if all the orgs are being displayed
	expect(screen.queryByText("Connect your GitHub organization to Jira")).toBeInTheDocument();
	expect(screen.queryByText("org-1")).toBeInTheDocument();
	expect(screen.queryByText("org-2")).toBeInTheDocument();
	expect(screen.queryByText("org-3")).toBeInTheDocument();

	// Checking the 3 connect buttons
	expect(await screen.findAllByRole("button", { name: "Connect" })).toHaveLength(3);

	// Clicking first connect button
	await act(async () => { await userEvent.click(screen.getAllByRole("button", { name: "Connect" })[0]); });
	expect(await screen.findAllByRole("button", { name: "Loading button" })).toHaveLength(1);
	expect(await screen.findAllByRole("button", { name: "Connect" })).toHaveLength(2);
	expect(screen.getAllByRole("button", { name: "Connect" })[0]).toBeDisabled();
	expect(screen.getAllByRole("button", { name: "Connect" })[1]).toBeDisabled();
	expect(screen.getByLabelText("Install new Org")).toBeDisabled();
	expect(AppManager.connectOrg).toBeCalled();
});

test("Connect GitHub Screen - Checking the GitHub Cloud flow when authenticated with no orgs", async () => {
	jest.mocked(OAuthManager).getUserDetails = AuthenticatedWithNoOrgs.getUserDetails;
	jest.mocked(OAuthManager).checkValidity = AuthenticatedWithNoOrgs.checkValidity;
	jest.mocked(AppManager).fetchOrgs = AuthenticatedWithNoOrgs.fetchOrgs;

	await act(async () => {
		render(
			<BrowserRouter>
				<ConfigSteps />
			</BrowserRouter>
		);
	});

	expect(screen.queryByText("GitHub Cloud")).not.toBeInTheDocument();
	expect(screen.queryByText("GitHub Enterprise Server")).not.toBeInTheDocument();
	expect(screen.queryByText("Get started")).not.toBeInTheDocument();
	expect(screen.queryByText("Select your GitHub product")).not.toBeInTheDocument();

	// Checking to see no orgs are being displayed
	expect(screen.queryByText("Connect your GitHub organization to Jira")).toBeInTheDocument();
	expect(screen.queryByText("org-1")).not.toBeInTheDocument();
	expect(screen.queryByText("org-2")).not.toBeInTheDocument();
	expect(screen.queryByText("org-3")).not.toBeInTheDocument();

	// Testing the click on the Install button
	expect(screen.queryByText("Add an organization")).toBeInTheDocument();
	await act(async() => { await userEvent.click(screen.getByText("Add an organization")); });
	expect(AppManager.installNewApp).toBeCalled();
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

	expect(screen.getByTestId("logged-in-as")).toHaveTextContent(`Logged in as ${OAuthManager.getUserDetails().username}.`);
	expect(screen.queryByText("Change GitHub login")).toBeInTheDocument();

	await act(() => userEvent.click(screen.getByText("Change GitHub login")));
	expect(window.open).toHaveBeenCalled();

	expect(screen.queryByText("GitHub Cloud")).toBeInTheDocument();
	expect(screen.queryByText("GitHub Enterprise Server")).toBeInTheDocument();
	expect(screen.queryByText("Get started")).toBeInTheDocument();
});


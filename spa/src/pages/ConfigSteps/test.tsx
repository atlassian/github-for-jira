import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import ConfigSteps from "./index";

const Authenticated = {
	checkValidity: jest.fn().mockReturnValue(Promise.resolve(true)),
	authenticateInGitHub: jest.fn().mockReturnValue(Promise),
	fetchOrgs: jest.fn(),
	setTokens: jest.fn(),
	getUserDetails: jest.fn().mockReturnValue({ username: "kay", email: "kay"}),
	clear: jest.fn(),
};
const UnAuthenticated = {
	checkValidity: jest.fn().mockReturnValue(Promise.resolve(false)),
	authenticateInGitHub: jest.fn().mockReturnValue(Promise),
	fetchOrgs: jest.fn(),
	setTokens: jest.fn(),
	getUserDetails: jest.fn().mockReturnValue({ username: "", email: ""}),
	clear: jest.fn(),
};

// Mocking the global variable
(global as any).AP = {
	getLocation: jest.fn(),
	context: {
		getContext: jest.fn(),
		getToken: jest.fn()
	}
};
(global as any).OAuthManagerInstance = UnAuthenticated;
window.open = jest.fn();

test("Connect GitHub Screen - Initial Loading of the page when not authenticated", () => {
	render(
		<BrowserRouter>
			<ConfigSteps />
		</BrowserRouter>
	);

	expect(screen.queryByText("Connect Github to Jira")).toBeInTheDocument();
	expect(screen.queryByText("GitHub Cloud")).toBeInTheDocument();
	expect(screen.queryByText("GitHub Enterprise Server")).toBeInTheDocument();
	expect(screen.queryByText("Connect your GitHub organization to Jira")).toBeInTheDocument();
	expect(screen.queryByRole("button")).toHaveTextContent("Authorize in GitHub");
});

test("Connect GitHub Screen - Checking the GitHub Enterprise flow when not authenticated", async () => {
	render(
		<BrowserRouter>
			<ConfigSteps />
		</BrowserRouter>
	);

	await act(() => userEvent.click(screen.getByText("GitHub Enterprise Server")));
	await act(() => userEvent.click(screen.getByText("Authorize in GitHub")));

	expect(AP.getLocation).toHaveBeenCalled();
});

test("Connect GitHub Screen - Checking the GitHub Cloud flow when not authenticated", async () => {
	render(
		<BrowserRouter>
			<ConfigSteps />
		</BrowserRouter>
	);

	await act(() => userEvent.click(screen.getByText("GitHub Cloud")));
	await act(() => userEvent.click(screen.getByText("Authorize in GitHub")));

	expect(OAuthManagerInstance.authenticateInGitHub).toHaveBeenCalled();
});

test("Connect GitHub Screen - Checking the GitHub Cloud flow when authenticated", () => {
	(global as any).OAuthManagerInstance = Authenticated;

	render(
		<BrowserRouter>
			<ConfigSteps />
		</BrowserRouter>
	);

	expect(screen.queryByText("GitHub Cloud")).not.toBeInTheDocument();
	expect(screen.queryByText("GitHub Enterprise Server")).not.toBeInTheDocument();
	expect(screen.queryByText("Authorize in GitHub")).not.toBeInTheDocument();
	expect(screen.queryByText("Log in and authorize")).toBeInTheDocument();
});

test("Connect GitHub Screen - Changing GitHub login when authenticated", async () => {
	(global as any).OAuthManagerInstance = Authenticated;

	render(
		<BrowserRouter>
			<ConfigSteps />
		</BrowserRouter>
	);

	await act(() => userEvent.click(screen.getByText("Log in and authorize")));

	expect(screen.queryByText("Change GitHub login")).toBeInTheDocument();

	await act(() => userEvent.click(screen.getByText("Change GitHub login")));

	expect(window.open).toHaveBeenCalled();

	expect(screen.queryByText("GitHub Cloud")).toBeInTheDocument();
	expect(screen.queryByText("GitHub Enterprise Server")).toBeInTheDocument();
	expect(screen.queryByText("Authorize in GitHub")).toBeInTheDocument();
});

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

// Mock the import of the css
jest.mock("simplebar-react/dist/simplebar.min.css", () => "");
// Mock the simplebar-react component
jest.mock("simplebar-react", () => ({
	__esModule: true,
	default: ({children}: {children: React.JSX.Element}) => <div>{children}</div>,
}));

/* eslint-disable react-refresh/only-export-components */
const Authenticated = {
	checkValidity: jest.fn().mockReturnValue(Promise.resolve(true)),
	authenticateInGitHub: jest.fn().mockReturnValue(Promise),
	fetchOrgs: jest.fn().mockReturnValue({ orgs: [ { account: { login: "org-1" }, id: 1, isAdmin: true }, { account: { login: "org-2" }, id: 2, isAdmin: true }, { account: { login: "org-3" }, id: 3, isAdmin: true  } ]}),
	installNewApp: jest.fn(),
	connectOrg: jest.fn(),
	setTokens: jest.fn(),
	getUserDetails: jest.fn().mockReturnValue({ username: "kay", email: "kay"}),
	clear: jest.fn(),
};
const AuthenticatedWithOrgsWithErrors = {
	checkValidity: jest.fn().mockReturnValue(Promise.resolve(true)),
	authenticateInGitHub: jest.fn().mockReturnValue(Promise),
	fetchOrgs: jest.fn().mockReturnValue({ orgs: [ { account: { login: "org-1" }, id: 1, isAdmin: false }, { account: { login: "org-2" }, id: 2, requiresSsoLogin: true }, { account: { login: "org-3" }, id: 3, isIPBlocked: true  }, { account: { login: "org-4" }, id: 4, isAdmin: true  } ]}),
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

// String values
const CONNECT_GITHUB_TO_JIRA = "Connect Github to Jira";
const GITHUB_CLOUD = "GitHub Cloud";
const GITHUB_ENTERPRISE = "GitHub Enterprise Server";
const SELECT_GH_PRODUCT = "Select your GitHub product";
const SELECT_GH_PRODUCT_CTA = "Next";
const SELECT_GH_TEXT = "Select a GitHub organization";
const NO_ORGS_INSTALL_ORG_CTA = "Select an organization in GitHub";

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

	expect(screen.queryByText(CONNECT_GITHUB_TO_JIRA)).toBeInTheDocument();
	expect(screen.queryByText(GITHUB_CLOUD)).toBeInTheDocument();
	expect(screen.queryByText(GITHUB_ENTERPRISE)).toBeInTheDocument();
	expect(screen.queryByText(SELECT_GH_PRODUCT)).toBeInTheDocument();
	expect(screen.queryByRole("button", { name: SELECT_GH_PRODUCT_CTA })).toHaveTextContent(SELECT_GH_PRODUCT_CTA);
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

	await act(() => userEvent.click(screen.getByText(GITHUB_ENTERPRISE)));
	await act(() => userEvent.click(screen.getByText(SELECT_GH_PRODUCT_CTA)));

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

	await act(() => userEvent.click(screen.getByText(GITHUB_CLOUD)));
	await act(() => userEvent.click(screen.getByText(SELECT_GH_PRODUCT_CTA)));

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

	expect(screen.queryByText(GITHUB_CLOUD)).not.toBeInTheDocument();
	expect(screen.queryByText(GITHUB_ENTERPRISE)).not.toBeInTheDocument();
	expect(screen.queryByText("Next ")).not.toBeInTheDocument();
	expect(screen.queryByText(SELECT_GH_PRODUCT)).not.toBeInTheDocument();

	// Checking if all the orgs are being displayed
	expect(screen.queryByText(SELECT_GH_TEXT)).toBeInTheDocument();
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
	expect(screen.getByLabelText("Install organization")).toBeDisabled();
	expect(AppManager.connectOrg).toBeCalled();
});

test("Connect GitHub Screen - Checking the GitHub Cloud flow when authenticated with orgs with errors", async () => {
	jest.mocked(OAuthManager).getUserDetails = AuthenticatedWithOrgsWithErrors.getUserDetails;
	jest.mocked(OAuthManager).checkValidity = AuthenticatedWithOrgsWithErrors.checkValidity;
	jest.mocked(AppManager).fetchOrgs = AuthenticatedWithOrgsWithErrors.fetchOrgs;
	jest.mocked(AppManager).installNewApp = AuthenticatedWithOrgsWithErrors.installNewApp;
	jest.mocked(AppManager).connectOrg = jest.fn().mockImplementation(async () => {
		//do not return, so that to assert on the loading icon
		return new Promise(_ => {});
	});

	const { container }  = render(
		<BrowserRouter>
			<ConfigSteps />
		</BrowserRouter>
	);
	await act(async () => container);

	expect(screen.queryByText(GITHUB_CLOUD)).not.toBeInTheDocument();
	expect(screen.queryByText(GITHUB_ENTERPRISE)).not.toBeInTheDocument();
	expect(screen.queryByText("Next ")).not.toBeInTheDocument();
	expect(screen.queryByText(SELECT_GH_PRODUCT)).not.toBeInTheDocument();

	// Checking if all the orgs are being displayed
	expect(screen.queryByText(SELECT_GH_TEXT)).toBeInTheDocument();
	expect(screen.queryByText("org-1")).toBeInTheDocument();
	expect(screen.queryByText("org-2")).toBeInTheDocument();
	expect(screen.queryByText("org-3")).toBeInTheDocument();
	expect(screen.queryByText("org-4")).toBeInTheDocument();

	// 3 orgs have errors, only 1 can be connected
	expect(await screen.findAllByRole("button", { name: "Connect" })).toHaveLength(1);

	const errorForNonAdmins = container.querySelectorAll("[class$='-ErrorForNonAdmins']");
	expect(errorForNonAdmins[0].textContent).toBe("Can't connect, you're not the organization owner.Ask an organization owner to complete this step.");

	const errorForSSO = container.querySelectorAll("[class$='-ErrorForSSO']");
	expect(errorForSSO[0].textContent).toBe("Can't connect, single sign-on(SSO) required.");
	expect(errorForSSO[1].textContent).toBe("1. Log into GitHub with SSO.");
	expect(errorForSSO[3].textContent).toBe("2. Retry connection in Jira (once logged in).");

	const errorForIPBlocked = container.querySelectorAll("[class$='-ErrorForIPBlocked']");
	expect(errorForIPBlocked[0].textContent).toBe("Can't connect, blocked by your IP allow list.");
	expect(errorForIPBlocked[1].textContent).toBe("How to update allowlist");
	expect(errorForIPBlocked[3].textContent).toBe("Retry");
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

	expect(screen.queryByText(GITHUB_CLOUD)).not.toBeInTheDocument();
	expect(screen.queryByText(GITHUB_ENTERPRISE)).not.toBeInTheDocument();
	expect(screen.queryByText(SELECT_GH_PRODUCT_CTA)).not.toBeInTheDocument();
	expect(screen.queryByRole("button", { name: SELECT_GH_PRODUCT_CTA })).not.toBeInTheDocument();
	expect(screen.queryByText(SELECT_GH_PRODUCT)).not.toBeInTheDocument();

	// Checking to see no orgs are being displayed
	expect(screen.queryByText(SELECT_GH_TEXT)).toBeInTheDocument();
	expect(screen.queryByText("org-1")).not.toBeInTheDocument();
	expect(screen.queryByText("org-2")).not.toBeInTheDocument();
	expect(screen.queryByText("org-3")).not.toBeInTheDocument();

	// Testing the click on the Install button
	expect(screen.queryByText(NO_ORGS_INSTALL_ORG_CTA)).toBeInTheDocument();
	await act(async() => { await userEvent.click(screen.getByText(NO_ORGS_INSTALL_ORG_CTA)); });
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

	expect(screen.queryByText(GITHUB_CLOUD)).toBeInTheDocument();
	expect(screen.queryByText(GITHUB_ENTERPRISE)).toBeInTheDocument();
	expect(screen.queryByRole("button", { name: SELECT_GH_PRODUCT_CTA })).toBeInTheDocument();
});



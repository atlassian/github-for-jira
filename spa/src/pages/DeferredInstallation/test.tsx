import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import DeferredInstallation from "./index";
import DeferralManager from "../../services/deferral-manager";
import OAuthManager from "../../services/oauth-manager";
import { AxiosError } from "axios";
import userEvent from "@testing-library/user-event";

jest.mock("../../services/deferral-manager");

const searchParams = { get: () => ({ "requestId": "request-id"}) };
const navigate = jest.fn();

jest.mock("react-router-dom", () => ({
	...(jest.requireActual("react-router-dom")),
	useSearchParams: () => [searchParams],
	useNavigate: () => navigate
}));

jest.mock("../../analytics/analytics-proxy-client", () => ({
	analyticsProxyClient: {
		sendScreenEvent: jest.fn(),
		sendUIEvent: jest.fn()
	}
}));

test("Invalid/Expired Deferred installation screen", async () => {
	jest.mocked(DeferralManager).extractFromRequestId = jest.fn().mockReturnValue(Promise.resolve(new AxiosError()));

	await act(async () => {
		render(
			<BrowserRouter>
				<DeferredInstallation />
			</BrowserRouter>
		);
	});

	expect(screen.getByText("This link is either expired or invalid.")).toBeTruthy();
	expect(screen.getByText("Connect a GitHub organization to Jira software")).toBeTruthy();
	expect(screen.getByTestId("content").textContent).toBe("Please inform the person who sent you the link that the link has expired and send a new link.");
});

test("Default Deferred installation screen", async () => {
	jest.mocked(DeferralManager).extractFromRequestId = jest.fn().mockReturnValue(Promise.resolve({ jiraHost: "https://myJirahost.com", orgName: "myOrg"}));

	await act(async () => {
		render(
			<BrowserRouter>
				<DeferredInstallation />
			</BrowserRouter>
		);
	});

	expect(screen.getByText("Connect Github to Jira")).toBeTruthy();
	expect(screen.getByText("Connect GitHub organization myOrg to Jira Software")).toBeTruthy();
	expect(screen.getByText("A Jira administrator has asked for approval to connect the GitHub organization myOrg to the Jira site https://myJirahost.com.")).toBeTruthy();
	expect(screen.getByText("Sign in & connect")).toBeTruthy();
});

test("Forbidden Deferred installation screen", async () => {
	jest.mocked(DeferralManager).extractFromRequestId = jest.fn().mockReturnValue(Promise.resolve({ jiraHost: "https://myJirahost.com", orgName: "myOrg"}));
	jest.mocked(DeferralManager).connectOrgByDeferral = jest.fn().mockReturnValue(Promise.resolve(new AxiosError()));
	jest.mocked(OAuthManager).authenticateInGitHub = jest.fn().mockReturnValue(Promise.resolve());
	jest.mocked(OAuthManager).finishOAuthFlow = jest.fn().mockReturnValue(Promise.resolve());

	await act(async () => {
		render(
			<BrowserRouter>
				<DeferredInstallation />
			</BrowserRouter>
		);
	});

	expect(screen.getByText("Sign in & connect")).toBeTruthy();

	// Clicking the button, which mocks the Authentication
	await userEvent.click(screen.getByText("Sign in & connect"));
	// Simulating the sending of message after successful authentication
	fireEvent(
		window,
		new MessageEvent("message", { data: { type: "oauth-callback", code: 1 } })
	);

	await waitFor(() => {
		expect(screen.getByText("The GitHub account you’ve used doesn’t have owner permissions for organization myOrg.")).toBeInTheDocument();
		expect(screen.getByText("Let the person who sent you the request know to")).toBeInTheDocument();
		expect(screen.getByText("find an owner for that organization.")).toBeInTheDocument();
	});
});
test("Successful Deferred installation screen", async () => {
	jest.mocked(DeferralManager).extractFromRequestId = jest.fn().mockReturnValue(Promise.resolve({ jiraHost: "https://myJirahost.com", orgName: "myOrg"}));
	jest.mocked(DeferralManager).connectOrgByDeferral = jest.fn().mockReturnValue(Promise.resolve(true));
	jest.mocked(OAuthManager).finishOAuthFlow = jest.fn().mockReturnValue(Promise.resolve());
	jest.mocked(OAuthManager).authenticateInGitHub = jest.fn().mockReturnValue(Promise.resolve());

	await act(async () => {
		render(
			<BrowserRouter>
				<DeferredInstallation />
			</BrowserRouter>
		);
	});

	expect(screen.getByText("Sign in & connect")).toBeTruthy();

	// Clicking the button, which mocks the Authentication
	await userEvent.click(screen.getByText("Sign in & connect"));
	// Simulating the sending of message after successful authentication
	fireEvent(
		window,
		new MessageEvent("message", { data: { type: "oauth-callback", code: 1 } })
	);

	await waitFor(() => {
		expect(navigate).toHaveBeenCalled();
		expect(navigate).toHaveBeenCalledWith("/spa/connected", {"state": {"orgLogin": "myOrg", "requestId": {"requestId": "request-id"}}});
	});
});

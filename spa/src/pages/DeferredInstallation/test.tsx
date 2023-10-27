import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import DeferredInstallation from "./index";
import DeferralManager from "../../services/deferral-manager";
import { AxiosError } from "axios";

jest.mock("../../services/deferral-manager");

const searchParams = { get: () => ({ "requestId": "request-id"}) };
jest.mock("react-router-dom", () => ({
	...(jest.requireActual("react-router-dom")),
	useSearchParams: () => [searchParams]
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

	expect(screen.getByText("This link is either expired or invalid")).toBeTruthy();
	expect(screen.getByText("Connect a GitHub organization to Jira software")).toBeTruthy();
	expect(screen.getByText("Please inform the person who sent you the link that the link has expired and send a new link.")).toBeTruthy();
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

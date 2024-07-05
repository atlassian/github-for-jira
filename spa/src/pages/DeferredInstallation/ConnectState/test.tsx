import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ConnectState from "./index";
import userEvent from "@testing-library/user-event";
import DeferralManager from "../../../services/deferral-manager";
import { AxiosError } from "axios";

const navigate = jest.fn();
jest.mock("react-router-dom", () => ({
	...(jest.requireActual("react-router-dom")),
	useNavigate: () => navigate,
	useLocation: () => ({
		"state": {
			"orgName": "myOrg",
			"jiraHost": "https://myJirahost.com",
			"requestId": {"requestId": "request-id"}
		}
	}),
}));
jest.mock("../../../services/deferral-manager");
jest.mock("../../../analytics/analytics-proxy-client", () => ({
	analyticsProxyClient: {
		sendScreenEvent: jest.fn(),
		sendUIEvent: jest.fn()
	}
}));

afterEach(() => {
	jest.clearAllMocks();
});

test("Connect State screen", async () => {
	render(
		<BrowserRouter>
			<ConnectState />
		</BrowserRouter>
	);

	expect(screen.getByText("Connect GitHub to Jira")).toBeTruthy();
	expect(screen.getByText("Connect GitHub organization myOrg to Jira Software")).toBeTruthy();
	expect(screen.getByText("A Jira administrator has asked for approval to connect the GitHub organization myOrg to the Jira site https://myJirahost.com.")).toBeTruthy();
	expect(screen.getByText("This will make all repositories in myOrg available to all projects in https://myJirahost.com. Import work from those GitHub repositories into Jira.")).toBeTruthy();
	expect(screen.getByText("Connect")).toBeTruthy();
});

test("If there is any error when connecting", async () => {
	jest.mocked(DeferralManager).connectOrgByDeferral = jest.fn().mockReturnValue(Promise.resolve(new AxiosError()));

	render(
		<BrowserRouter>
			<ConnectState />
		</BrowserRouter>
	);

	await userEvent.click(screen.getByText("Connect"));

	expect(navigate).toHaveBeenCalled();
	expect(navigate).toHaveBeenCalledWith("forbidden", {
		"state": {
			"requestId": {"requestId": "request-id"}
		}
	});
});

test("When GitHub non-admins are connecting", async () => {
	jest.mocked(DeferralManager).connectOrgByDeferral = jest.fn().mockReturnValue(Promise.resolve(false));

	render(
		<BrowserRouter>
			<ConnectState />
		</BrowserRouter>
	);

	await userEvent.click(screen.getByText("Connect"));

	expect(navigate).toHaveBeenCalled();
	expect(navigate).toHaveBeenCalledWith("forbidden", {
		"state": {
			"requestId": {"requestId": "request-id"}
		}
	});
});

test("When GitHub admins are connecting", async () => {
	jest.mocked(DeferralManager).connectOrgByDeferral = jest.fn().mockReturnValue(Promise.resolve(true));

	render(
		<BrowserRouter>
			<ConnectState />
		</BrowserRouter>
	);

	await userEvent.click(screen.getByText("Connect"));

	expect(navigate).toHaveBeenCalled();
	expect(navigate).toHaveBeenCalledWith("/spa/connected", {
		"state": {
			"orgLogin": "myOrg",
			"requestId": {"requestId": "request-id"}
		}
	});
});

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import DeferredInstallation from "./index";
import DeferralManager from "../../services/deferral-manager";
import { AxiosError, AxiosResponse } from "axios";
import userEvent from "@testing-library/user-event";
import Api from "../../api";

jest.mock("../../services/deferral-manager");
jest.mock("../../api");

const searchParams = { get: () => ({ "requestId": "request-id"}) };
const navigate = jest.fn();
window.open = jest.fn();

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

afterEach(() => {
	jest.clearAllMocks();
});

test("Default/Start Deferred installation screen", async () => {
	render(
		<BrowserRouter>
			<DeferredInstallation />
		</BrowserRouter>
	);

	expect(screen.getByText("Connect GitHub to Jira")).toBeTruthy();
	expect(screen.getByText("Connect a GitHub organization to Jira Software")).toBeTruthy();
	expect(screen.getByText("A Jira administrator has asked for approval to connect a GitHub organization to a Jira site.")).toBeTruthy();
	expect(screen.getByText("Sign in")).toBeTruthy();
});
test("Invalid/Expired Deferred installation screen", async () => {
	jest.mocked(DeferralManager).extractFromRequestId = jest.fn().mockReturnValue(Promise.resolve(new AxiosError()));
	jest.mocked(Api).auth.generateOAuthUrl = jest.fn().mockReturnValue(Promise.resolve({
		data: {
			redirectUrl: "https://redirect-url.com",
			state: 1
		}
	}));

	render(
		<BrowserRouter>
			<DeferredInstallation />
		</BrowserRouter>
	);

	// Clicking the button, which mocks the Authentication
	await userEvent.click(screen.getByText("Sign in"));
	// Simulating the sending of message after successful authentication
	fireEvent(
		window,
		new MessageEvent("message", { data: { type: "oauth-callback", code: 1 } })
	);

	await waitFor(() => {
		expect(navigate).toHaveBeenCalled();
		expect(navigate).toHaveBeenCalledWith("error", {
			"state": {
				"error": {
					"errorCode": "INVALID_DEFERRAL_REQUEST_ID",
					"message": "This link is either expired or invalid.",
					"type": "error"
				},
				"requestId": {
					"requestId": "request-id"
				}
			}
		});
	});
});
test("Forbidden Deferred installation screen", async () => {
	jest.mocked(DeferralManager).extractFromRequestId = jest.fn().mockReturnValue(
		Promise.resolve(new AxiosError("","", undefined, undefined, { status: 403 } as AxiosResponse))
	);
	jest.mocked(Api).auth.generateOAuthUrl = jest.fn().mockReturnValue(Promise.resolve({
		data: {
			redirectUrl: "https://redirect-url.com",
			state: 1
		}
	}));

	render(
		<BrowserRouter>
			<DeferredInstallation />
		</BrowserRouter>
	);

	// Clicking the button, which mocks the Authentication
	await userEvent.click(screen.getByText("Sign in"));
	// Simulating the sending of message after successful authentication
	fireEvent(
		window,
		new MessageEvent("message", { data: { type: "oauth-callback", code: 1 } })
	);

	await waitFor(() => {
		expect(navigate).toHaveBeenCalled();
		expect(navigate).toHaveBeenCalledWith("forbidden", {
			"state": {
				"requestId": {
					"requestId": "request-id"
				}
			}
		});
	});
});
test("Successful Deferred installation screen", async () => {
	jest.mocked(DeferralManager).extractFromRequestId = jest.fn().mockReturnValue(Promise.resolve({ jiraHost: "https://myJirahost.com", orgName: "myOrg"}));
	jest.mocked(Api).auth.generateOAuthUrl = jest.fn().mockReturnValue(Promise.resolve({
		data: {
			redirectUrl: "https://redirect-url.com",
			state: 1
		}
	}));

	render(
		<BrowserRouter>
			<DeferredInstallation />
		</BrowserRouter>
	);

	// Clicking the button, which mocks the Authentication
	await userEvent.click(screen.getByText("Sign in"));
	// Simulating the sending of message after successful authentication
	fireEvent(
		window,
		new MessageEvent("message", { data: { type: "oauth-callback", code: 1 } })
	);

	await waitFor(() => {
		expect(navigate).toHaveBeenCalled();
		expect(navigate).toHaveBeenCalledWith("connect", {
			"state": {
				"orgName": "myOrg",
				"jiraHost": "https://myJirahost.com",
				"requestId": {"requestId": "request-id"}
			}
		});
	});
});

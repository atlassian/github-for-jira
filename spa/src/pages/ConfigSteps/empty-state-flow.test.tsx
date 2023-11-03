import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfigSteps from "./index";
import Connected from "../Connected";
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import nock from "nock";

describe("Empty state user flow", () => {

	let mockWinOpenFunc: jest.Mock;
	beforeEach(() => {
		setupGlobalAP();
		nockApiResponse();
	});


	it.only("should open new tab to log user into GitHub", async () => {

		await act(async () => {
			render(
				<MemoryRouter initialEntries={["/spa/steps"]}>
					<Routes>
						<Route path="/spa">
							<Route path="steps" element={<ConfigSteps />} />
							<Route path="connected" element={<Connected />}/>
						</Route>
					</Routes>
				</MemoryRouter>
			);
		});

		//Ensure user is not logged in.
		await waitFor(() => expectUserNotLogin());

		//Start OAuth flow
		await clickButton("Next");
		await waitFor(() => expect(mockWinOpenFunc).toHaveBeenLastCalledWith("some-redirect-url", "_blank"));

		try {
		//Finish Oauth flow
		await postMessage({ type: "oauth-callback", code: "some-code", state: "some-state" });
		//Ensure logged in
		await waitFor(() => expectUserLoginSuccess("some-login"));

		//Because empty state, check app auto popup new github app install page
		await waitFor(() => expect(mockWinOpenFunc).toHaveBeenLastCalledWith("some-app-install-url", "_blank"));

		//Now trigger app installed on github
		await postMessage({ type: "install-callback", gitHubInstallationId: 1111 });

		//Should navigate to success screen
		await waitFor(() => expect(screen.queryByText("Check your backfill status")).toBeInTheDocument());
		}catch(e) {
		}

	});

	function nockApiResponse() {

		const scope = nock("http://localhost").persist();

		scope.post("/rest/app/cloud/analytics-proxy").reply(200);

		scope.get("/rest/app/cloud/oauth/redirectUrl").reply(200, {
			redirectUrl: "some-redirect-url",
			state: "some-state"
		});

		scope.post("/rest/app/cloud/analytics-proxy").reply(200);
		scope.get("/rest/app/cloud/installation/new").reply(200, {
			appInstallationUrl: "some-app-install-url"
		});
		scope.post("/rest/app/cloud/oauth/exchangeToken").reply(200, {
			accessToken: "some-access-token",
			refreshToken: "some-refresh-token"
		});
		scope.get("/rest/app/cloud/org").reply(200, {
			orgs: []
		});
		scope.post("/rest/app/cloud/org").reply(200);
		//github
		const gitHubScope = nock("https://api.github.com")
			.persist()
			.defaultReplyHeaders({
				'access-control-allow-origin': '*',
				'access-control-allow-credentials': 'true',
				'access-control-allow-headers': 'Authorization'
			})
		gitHubScope.options(/.*/).reply(204, undefined, {
			"Allow": "OPTIONS, HEDA, GET, POST, DELETE, PUT, PATCH"
		});
		gitHubScope.get("/user").reply(200, {
			email: "some@email.com",
			login: "some-login"
		});
	}

	async function clickButton(buttonText: string) {
		await act(async() => {
			await userEvent.click(screen.getByText(buttonText));
		});
	}

	function expectUserNotLogin() {
		expect(screen.queryByText("Select your GitHub product", { exact: false })).toBeInTheDocument();
		expect(screen.queryByText("Logged in as", { exact: false })).not.toBeInTheDocument();
	}

	function expectUserLoginSuccess(login: string) {
		expect(screen.queryByText("Select your GitHub product")).not.toBeInTheDocument();
		expect(screen.queryByText("Change GitHub login")).toBeInTheDocument();
		expect(screen.queryByText("Logged in as", { exact: false })).toBeInTheDocument();
		expect(screen.queryByText(login)).toBeInTheDocument();
	}

	function setupGlobalAP() {
		(global as any).AP = {
			getLocation: jest.fn(),
			context: {
				getContext: jest.fn(),
				getToken: jest.fn().mockImplementation((cb: (token: string) => void) => cb("some-token"))
			},
			navigator: {
				go: jest.fn(),
				reload: jest.fn()
			}
		};
		(global as any).open = mockWinOpenFunc = jest.fn().mockReturnValue({
			closed: false
		});
	}

	async function postMessage(data: any) {
		await act(async () => {
			fireEvent(window, new MessageEvent("message", {
				bubbles: true,
				origin: window.location.origin,
				data
			}));
		});
	}

});

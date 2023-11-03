import { act, render, screen, waitFor } from "@testing-library/react";
import ConfigSteps from "./index";
import Connected from "../Connected";
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import nock from "nock";

import * as testUtils from "../../utils/test-helper";

describe("Empty state user flow", () => {

	beforeEach(() => {
		testUtils.setupGlobalAP();
		nockApiResponse();
	});


	it("should open new tab to log user into GitHub", async () => {

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
		await waitFor(() => testUtils.expectUserNotLogin());

		//Start OAuth flow
		await testUtils.clickButton("Next");
		await waitFor(() => testUtils.expectPopupWith("some-redirect-url", "_blank"));

		try {
		//Finish Oauth flow
		await testUtils.postMessage({ type: "oauth-callback", code: "some-code", state: "some-state" });
		//Ensure logged in
		await waitFor(() => testUtils.expectUserLoginSuccess("some-login"));

		//Because empty state, check app auto popup new github app install page
		await waitFor(() => testUtils.expectPopupWith("some-app-install-url", "_blank"));

		//Now trigger app installed on github
		await testUtils.postMessage({ type: "install-callback", gitHubInstallationId: 1111 });

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


});

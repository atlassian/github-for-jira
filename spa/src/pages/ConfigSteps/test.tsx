import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import ConfigSteps from "./index";
import OauthManager from "../../oauth-manager";

// Mocking the global variable
(global as any).AP = {
	getLocation: jest.fn(),
	context: {
		getContext: jest.fn()
	}
};
(global as any).OAuthManagerInstance = OauthManager();

test("Connect GitHub Screen - Initial Loading of the page", () => {
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

test("Connect GitHub Screen - Checking the GitHub Enterprise flow", async () => {
	render(
		<BrowserRouter>
			<ConfigSteps />
		</BrowserRouter>
	);

	await userEvent.click(screen.getByText("GitHub Enterprise Server"));
	await userEvent.click(screen.getByText("Authorize in GitHub"));

	expect(AP.getLocation).toHaveBeenCalled();
});

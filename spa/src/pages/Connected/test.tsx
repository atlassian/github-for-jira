import { BrowserRouter } from "react-router-dom";
import { act, render, screen } from "@testing-library/react";
import Connected from "./index";
import userEvent from "@testing-library/user-event";

// Mocking the global variable
/* eslint-disable @typescript-eslint/no-explicit-any*/
(global as any).AP = {
	navigator: {
		go: jest.fn()
	}
};
(global as any).open = jest.fn();

const navigate = jest.fn();
jest.mock("react-router-dom", () => ({
	...jest.requireActual("react-router-dom"),
	useNavigate: () => navigate
}));

jest.mock("../../analytics/analytics-proxy-client", () => {
	return {
		analyticsProxyClient: {
			sendScreenEvent: jest.fn(),
			sendUIEvent: jest.fn()
		}
	};
});

test("Basic check for the Connected Page", async () => {
	render(
		<BrowserRouter>
			<Connected />
		</BrowserRouter>
	);

	expect(screen.queryByText("GitHub is connected!")).toBeInTheDocument();
	expect(screen.queryByText("What's next?")).toBeInTheDocument();
	expect(screen.queryByText("Add issue keys in GitHub")).toBeInTheDocument();
	expect(screen.queryByText("Collaborate in Jira")).toBeInTheDocument();
	expect(screen.queryByText("Learn about issue linking")).toBeInTheDocument();
	expect(screen.queryByText("Learn about development work in Jira")).toBeInTheDocument();
	expect(screen.queryByText("Check your backfill status")).toBeInTheDocument();
	expect(screen.queryByText("Add another organization")).toBeInTheDocument();

	await userEvent.click(screen.getByText("Learn about issue linking"));
	expect(window.open).toHaveBeenCalled();

	await userEvent.click(screen.getByText("Learn about development work in Jira"));
	expect(window.open).toHaveBeenCalled();

	await userEvent.click(screen.getByText("Check your backfill status"));
	expect(AP.navigator.go).toHaveBeenCalled();

	await act(() => userEvent.click(screen.getByText("Add another organization")));
	expect(navigate).toHaveBeenCalledWith("/spa/steps");

});

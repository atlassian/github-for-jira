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
	useNavigate: () => navigate,
	useLocation: jest.fn().mockReturnValue({
		state: { orgLogin: "AtlassianOrg" },
	}),
}));
jest.mock("./../../feature-flags", () => ({
	enableBackfillStatusPage: false
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

	expect(screen.queryByText("AtlassianOrg is now connected!")).toBeInTheDocument();
	expect(screen.queryByText("Add another organization")).toBeInTheDocument();
	expect(screen.queryByText("How to add issue keys")).toBeInTheDocument();
	expect(screen.queryByText("Exit set up")).toBeInTheDocument();

	await userEvent.click(screen.getByText("How to add issue keys"));
	expect(window.open).toBeCalledWith("https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/", "_blank");

	await userEvent.click(screen.getByText("Exit set up"));
	expect(AP.navigator.go).toHaveBeenCalled();

	await act(() => userEvent.click(screen.getByText("Add another organization")));
	expect(navigate).toHaveBeenCalledWith("/spa/steps");
});
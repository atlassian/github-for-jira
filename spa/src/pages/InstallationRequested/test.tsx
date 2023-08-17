import { BrowserRouter } from "react-router-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InstallationRequested from "./index";
import OAuthManager from "../../services/oauth-manager";

const navigate = jest.fn();
jest.mock("react-router-dom", () => ({
	...jest.requireActual("react-router-dom"),
	useNavigate: () => navigate
}));
jest.mock("../../services/oauth-manager");
window.open = jest.fn();

test("Basic check for the Connected Page", async () => {
	jest.mocked(OAuthManager).getUserDetails = jest.fn().mockReturnValue({ username: "kay" });
	jest.mocked(OAuthManager).clear = jest.fn();

	render(
		<BrowserRouter>
			<InstallationRequested />
		</BrowserRouter>
	);

	expect(screen.queryByText("Once the owner of this organization has installed Jira, you (or another Jira admin) can come back here and finish the set up.")).toBeInTheDocument();
	expect(screen.queryByText("Add another organization")).toBeInTheDocument();
	expect(screen.queryByText("Change GitHub login")).toBeInTheDocument();

	await act(() => userEvent.click(screen.getByText("Add another organization")));
	expect(navigate).toHaveBeenCalledWith("/spa/steps");

	await act(() => userEvent.click(screen.getByText("Change GitHub login")));
	expect(window.open).toHaveBeenCalled();
	expect(OAuthManager.clear).toHaveBeenCalled();
});

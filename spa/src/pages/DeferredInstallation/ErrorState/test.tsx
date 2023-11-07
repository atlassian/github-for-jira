import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ErrorState from "./index";

window.open = jest.fn();

jest.mock("react-router-dom", () => ({
	...(jest.requireActual("react-router-dom")),
	useLocation: () => ({
		"state": {
			"error": {
				"type": "error",
				"message": "This is the error message",
				"errorCode": "UNKNOWN"
			},
			"requestId": {
				"requestId": "request-id"
			}
		}
	}),
}));

test("Error State screen", async () => {
	render(
		<BrowserRouter>
			<ErrorState />
		</BrowserRouter>
	);

	expect(screen.getByText("Connect Github to Jira")).toBeTruthy();
	expect(screen.getByText("Connect a GitHub organization to Jira software")).toBeTruthy();
	expect(screen.getByText("This is the error message")).toBeTruthy();
	expect(screen.getByText("Please inform the person who sent you the link that the link has expired and send a new link.")).toBeTruthy();
});

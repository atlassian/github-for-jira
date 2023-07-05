import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import StartConnection from "./index";

test("Entry Config Screen", async () => {
	render(
		<BrowserRouter>
			<StartConnection />
		</BrowserRouter>
	);

	expect(screen.getByText("Connect Github to Jira")).toBeTruthy();
	expect(screen.getByText("Before you start, you'll need:")).toBeTruthy();
	expect(screen.getByText("A GitHub account")).toBeTruthy();
	expect(screen.getByText("Owner permission for a GitHub organization")).toBeTruthy();
	expect(screen.getByRole("button")).toHaveTextContent("Continue");
	expect(window.location.pathname).toBe("/");

	await userEvent.click(screen.getByRole("button"));
	expect(window.location.pathname).toBe("/steps");
});

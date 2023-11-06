import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ForbiddenState from "./index";

test("Forbidden State screen", async () => {
	render(
		<BrowserRouter>
			<ForbiddenState />
		</BrowserRouter>
	);

	expect(screen.getByText("Connect Github to Jira")).toBeTruthy();
	expect(screen.getByText("Can’t connect this organization because you don’t have owner permissions")).toBeTruthy();
	expect(screen.getByText("The GitHub account you’ve used doesn’t have owner permissions to connect to the GitHub organization.")).toBeTruthy();
	expect(screen.getByText("Let the person who sent you the request know to find an owner for that organization.")).toBeTruthy();
});

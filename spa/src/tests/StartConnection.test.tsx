import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import StartConnection from "./../pages/StartConnection";

/**
 * This is a test case for the dummy component
 * TODO: Remove this dummy component test case and add the actual ones
 */
test("Testing the dummy component", async () => {
	render(<StartConnection />);
	expect(screen.queryByText("Connect GitHub to Jira")).toBeTruthy();
});

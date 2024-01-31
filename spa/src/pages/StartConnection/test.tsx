import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import StartConnection from "./index";

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
(global as unknown as { FRONTEND_FEATURE_FLAGS: Record<string, boolean> }).FRONTEND_FEATURE_FLAGS = { ENABLE_5KU_BACKFILL_PAGE: false };

test("Entry Config Screen", async () => {
	render(
		<BrowserRouter>
			<StartConnection />
		</BrowserRouter>
	);

	expect(screen.getByText("Connect Github to Jira")).toBeTruthy();
	expect(screen.getByText("Before you start, you should have:")).toBeTruthy();
	expect(screen.getByText("A GitHub account")).toBeTruthy();
	expect(screen.getByText("Owner permission for a GitHub organization")).toBeTruthy();
	expect(screen.getByRole("button", { name: "continue" })).toHaveTextContent("Continue");
	expect(window.location.pathname).toBe("/");

	await userEvent.click(screen.getByRole("button", { name: "continue" }));
	expect(window.location.pathname).toBe("/steps");
});

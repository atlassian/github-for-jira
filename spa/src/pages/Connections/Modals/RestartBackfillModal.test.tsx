import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import RestartBackfillModal from "./RestartBackfillModal";

const sampleSubscription = {
	app_slug: "string",
	syncWarning: "warning",
	id: 1,
	account:  {
		login: "sample",
		id: 1,
		avatar_url: "string",
	},
	repository_selection: "string",
	app_id: 1,
	target_id: 1,
	target_type: "string",
	created_at: "string",
	updated_at: "string",
	syncStatus: "string",
	totalNumberOfRepos: 2,
	numberOfSyncedRepos: 2,
	jiraHost: "https://test-jira.atlassian.net",
	isGlobalInstall: true,
	backfillSince: null,
	subscriptionId: 1
};
const isModalOpened = jest.fn();

test("Restart backfill Modal", async () => {
	const { container } = render(
		<BrowserRouter>
			<RestartBackfillModal subscription={sampleSubscription} setIsModalOpened={isModalOpened} />
		</BrowserRouter>
	);

	expect(screen.getByText("Backfill your data")).toBeInTheDocument();
	expect(container.querySelector("input#backfill-date-picker")).toBeInTheDocument();
	expect(container.querySelector("input[type='checkbox']")).toBeInTheDocument();

	await userEvent.click(screen.getByText("Cancel"));
	expect(isModalOpened).toBeCalled();
});

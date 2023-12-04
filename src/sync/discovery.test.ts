import { getLogger } from "config/logger";
import { getRepositoryTask } from "~/src/sync/discovery";
import { createInstallationClient } from "utils/get-github-client-config";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { Repository } from "models/subscription";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { GetRepositoriesQuery } from "~/src/github/client/github-queries";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { PageSizeAwareCounterCursor } from "~/src/sync/page-counter-cursor";

jest.mock("config/feature-flags");

describe("discovery", () => {

	let data: BackfillMessagePayload;

	beforeEach(async () => {
		data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, commitsFromDate: "2023-01-01" };
		githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		when(booleanFlag).calledWith(BooleanFlags.USE_REST_API_FOR_DISCOVERY, jiraHost).mockResolvedValue(false);
		mockSystemTime(12345678);
		await new DatabaseStateCreator().create();
	});

	it("fetches and transforms data from GitHub when FF is OFF", async () => {
		githubNock.post("/graphql", {
			query: GetRepositoriesQuery,
			variables: {
				per_page: 10,
				cursor: "somecursor"
			}
		}).reply(200,{
			data: {
				viewer: {
					repositories: {
						totalCount: 10,
						pageInfo: {
							endCursor: "somecursor",
							hasNextPage: true
						},
						edges: [
							{
								node: {
									id: 123456,
									name: "my-repo",
									full_name: "my-username/my-repo",
									owner: {
										login: "my-username"
									},
									html_url: "https://github.com/my-username/my-repo",
									updated_at: "2022-02-22T16:05:49Z"
								}
							}
						]
					}
				}
			}
		});

		const gitHubClient = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, getLogger("test"), undefined);
		expect(await getRepositoryTask(
			getLogger("test"),
			gitHubClient,
			jiraHost,
			undefined as unknown as Repository,
			"somecursor",
			10,
			data
		)).toEqual({
			edges: [{
				cursor: "somecursor",
				node: expect.anything()
			}],
			jiraPayload: undefined
		});
	});

	it("fetches and transforms data from GitHub when FF is ON", async () => {
		when(booleanFlag).calledWith(BooleanFlags.USE_REST_API_FOR_DISCOVERY, jiraHost).mockResolvedValue(true);
		const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, commitsFromDate: "2023-01-01" };

		githubNock.get("/installation/repositories?per_page=10&page=79").reply(200, {
			repositories: [{
				id: 1,
				name: "reponame",
				full_name: "org/name",
				owner: { login: "ownerLogin" },
				html_url: "https://atlassian.com",
				updated_at: "2022-01-01"
			}] });

		const gitHubClient = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, getLogger("test"), undefined);
		expect(await getRepositoryTask(
			getLogger("test"),
			gitHubClient,
			jiraHost,
			undefined as unknown as Repository,
			new PageSizeAwareCounterCursor("40").serialise(),
			10,
			data
		)).toEqual({
			edges: [{
				cursor: "{\"perPage\":10,\"pageNo\":80}",
				node: expect.anything()
			}],
			jiraPayload: undefined
		});
	});
});

import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { createInstallationClient } from "utils/get-github-client-config";
import { getLogger } from "config/logger";
import { getBranchesResponse } from "~/src/github/client/github-queries";
import { cloneDeep } from "lodash";

describe("github-installation-client", () => {
	beforeEach(async () => {
		await new DatabaseStateCreator().create();
	});

	describe("getCommitsPage", () => {
		it("retries changedFiles error", async () => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			const client = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, getLogger("test"), undefined);

			githubNock.post("/graphql").reply(200, {
				errors: [
					{
						message: "The changedFiles count for this commit is unavailable.",
						locations: [
							{
								line: 9,
								column: 21
							}
						],
						path: [ ]
					}
				]
			}).post("/graphql").reply(200, {
				data: {
					foo: "bar"
				}
			});

			const data = await client.getCommitsPage("testOwner", "testRepoName");
			expect(data).toStrictEqual({ foo: "bar" });
		});

		it("retries 502 error", async () => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			const client = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, getLogger("test"), undefined);

			githubNock
				.post("/graphql")
				.reply(502)
				.post("/graphql")
				.reply(200, {
					data: {
						foo: "bar"
					}
				});

			const data = await client.getCommitsPage("testOwner", "testRepoName");
			expect(data).toStrictEqual({ foo: "bar" });
		});
	});

	describe("getBranchesPage", () => {
		it("retries changedFiles error", async () => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			const client = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, getLogger("test"), undefined);

			githubNock.post("/graphql").reply(200, {
				errors: [
					{
						message: "The changedFiles count for this commit is unavailable.",
						locations: [
							{
								line: 9,
								column: 21
							}
						],
						path: [ ]
					}
				]
			}).post("/graphql").reply(200, {
				data: {
					foo: "bar"
				}
			});

			const data = await client.getBranchesPage("testOwner", "testRepoName");
			expect(data).toStrictEqual({ foo: "bar" });
		});

		it("retries 502 error", async () => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			const client = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, getLogger("test"), undefined);

			githubNock
				.post("/graphql")
				.reply(502)
				.post("/graphql")
				.reply(200, {
					data: {
						foo: "bar"
					}
				});

			const data = await client.getBranchesPage("testOwner", "testRepoName");
			expect(data).toStrictEqual({ foo: "bar" });
		});

		it("retries 502 error 2 times", async () => {
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			const client = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, getLogger("test"), undefined);

			const EXPECTED_RESPONSE: getBranchesResponse = {
				repository: {
					refs: {
						edges: [
							{
								cursor: "some-cursor",
								node: {
									associatedPullRequests: {
										nodes: [
											{
												title: "Some PR title"
											},
											{
												title: "Another PR title"
											}
										]
									},
									name: "branch-name",
									target: {
										author: {
											avatarUrl: "https://example.com/avatar.jpg",
											email: "author@example.com",
											name: "John Doe"
										},
										history: {
											nodes: []
										},
										authoredDate: "2022-01-01T12:00:00Z",
										changedFiles: 3,
										oid: "some-commit-oid",
										message: "Commit message",
										url: "https://example.com/commit-url"
									}
								}
							}
						]
					}
				}
			};

			const returnedData = cloneDeep(EXPECTED_RESPONSE);
			delete (returnedData.repository.refs.edges[0].node.target as unknown as any).history;

			githubNock
				.post("/graphql")
				.reply(502)
				.post("/graphql")
				.reply(502)
				.post("/graphql")
				.reply(200, {
					data: returnedData
				});

			const data = await client.getBranchesPage("testOwner", "testRepoName");
			expect(data).toStrictEqual(EXPECTED_RESPONSE);
		});
	});
});

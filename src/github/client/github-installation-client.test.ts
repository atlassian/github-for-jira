import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { createInstallationClient } from "utils/get-github-client-config";
import { getLogger } from "config/logger";

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
	});
});

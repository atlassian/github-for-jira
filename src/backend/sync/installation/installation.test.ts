/* eslint-disable @typescript-eslint/no-var-requires */
import { sortedRepos } from ".";

describe("Sync helpers suite", () => {
	const repoSyncState = require("../../../../test/fixtures/repo-sync-state.json");
	const sortedReposFunc = require("../../../../test/fixtures/sorted-repos.json");

	it("sortedRepos should sort repos by updated_at", () => {
		expect(sortedRepos(repoSyncState)).toEqual(sortedReposFunc);
	});
});

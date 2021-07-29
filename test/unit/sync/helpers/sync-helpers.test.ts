/* eslint-disable @typescript-eslint/no-var-requires */
import { sortedRepos } from "../../../../src/sync/installation";

describe("Sync helpers suite", () => {
	const repoSyncState = require("../../../fixtures/repo-sync-state.json");
	const sortedReposFunc = require("../../../fixtures/sorted-repos.json");

	it("sortedRepos should sort repos by updated_at", () => {
		expect(sortedRepos(repoSyncState)).toEqual(sortedReposFunc);
	});
});

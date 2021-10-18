import RepoSyncStateClass from "../../src/models/reposyncstate";
import { RepoSyncState } from "../../src/models";

describe("RepoSyncState", () => {
	let state: RepoSyncStateClass;

	beforeEach(async () => {
		state = await RepoSyncState.create({
			gitHubInstallationId: 123,
			jiraHost: "http://blah.com",
			jiraClientKey: "myClientKey",
			repoSyncState: undefined,
			updatedAt: new Date(),
			createdAt: new Date()
		});
	});

	afterEach(async () => {
		await state.destroy();
	});

});

import { notFoundErrorOctokitRequest } from '../../../mocks/errorResponses';
/* eslint-disable @typescript-eslint/no-var-requires */
import {
	sortedRepos,
	handleNotFoundErrors,
} from "../../../../src/sync/installation";

describe("Sync helpers suite", () => {
	const repoSyncState = require("../../../fixtures/repo-sync-state.json");
	const sortedReposFunc = require("../../../fixtures/sorted-repos.json");

	it("sortedRepos should sort repos by updated_at", () => {
		expect(sortedRepos(repoSyncState)).toEqual(sortedReposFunc);
	});

	describe("handleNotFoundErrors", () => {
		it("should continue sync if NOT FOUND error is sent in response from octokit/request", () => {
			const mockHandleNotFoundPayload = {
				err: notFoundErrorOctokitRequest
				// err,
				// queues,
				// job,
				// task,
				// repositoryId,
				// nextTask
			}
			// expect(sortedRepos(repoSyncState)).toEqual(sortedReposFunc);
		});

		// it("handleNotFoundErrors should not continue sync for any other error response type", () => {
		// 	// expect(sortedRepos(repoSyncState)).toEqual(sortedReposFunc);
		// });
	});
});

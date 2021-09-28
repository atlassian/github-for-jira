import {
	mockNotFoundErrorOctokitRequest,
	mockNotFoundErrorOctokitGraphql,
	mockOtherOctokitRequestErrors,
	mockOtherOctokitGraphqlErrors,
	mockOtherError,
	mockJob,
	mockNextTask,
} from "../../../mocks/errorResponses";
/* eslint-disable @typescript-eslint/no-var-requires */
import {
	sortedRepos,
	isNotFoundError,
} from "../../../../src/sync/installation";

describe("Sync helpers suite", () => {
	const repoSyncState = require("../../../fixtures/repo-sync-state.json");
	const sortedReposFunc = require("../../../fixtures/sorted-repos.json");

	it("sortedRepos should sort repos by updated_at", () => {
		expect(sortedRepos(repoSyncState)).toEqual(sortedReposFunc);
	});

	describe("handleNotFoundErrors", () => {
		it("should continue sync if 404 status is sent in response from octokit/request", (): void => {
			// returns true if status is 404 so sync will continue
			expect(
				isNotFoundError(
					mockNotFoundErrorOctokitRequest,
					mockJob,
					mockNextTask
				)
			).toBeTruthy();
		});

		it("should continue sync if NOT FOUND error is sent in response from octokit/graphql", (): void => {
			// returns true if error object has type 'NOT_FOUND' so sync will continue
			expect(
				isNotFoundError(
					mockNotFoundErrorOctokitGraphql,
					mockJob,
					mockNextTask
				)
			).toBeTruthy();
		});

		it("handleNotFoundErrors should not continue sync for any other error response type", () => {
			expect(
				isNotFoundError(
					mockOtherOctokitRequestErrors,
					mockJob,
					mockNextTask
				)
			).toBeFalsy();

			expect(
				isNotFoundError(
					mockOtherOctokitGraphqlErrors,
					mockJob,
					mockNextTask
				)
			).toBeFalsy();

			expect(
				isNotFoundError(
					mockOtherError,
					mockJob,
					mockNextTask
				)
			).toBeFalsy();

			expect(
				isNotFoundError(
					null,
					mockJob,
					mockNextTask
				)
			).toBeFalsy();

			expect(
				isNotFoundError(
					"",
					mockJob,
					mockNextTask
				)
			).toBeFalsy();
		});
	});
});

import { mockJob, mockNextTask, mockNotFoundErrorOctokitGraphql, mockNotFoundErrorOctokitRequest, mockOtherError, mockOtherOctokitGraphqlErrors, mockOtherOctokitRequestErrors } from "../../../mocks/errorResponses";
/* eslint-disable @typescript-eslint/no-var-requires */
import { handleNotFoundErrors, sortedRepos } from "../../../../src/sync/installation";

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
				handleNotFoundErrors(
					mockNotFoundErrorOctokitRequest,
					mockJob,
					mockNextTask
				)
			).toBeTruthy();
		});

		it("should continue sync if NOT FOUND error is sent in response from octokit/graphql", (): void => {
			// returns true if error object has type 'NOT_FOUND' so sync will continue
			expect(
				handleNotFoundErrors(
					mockNotFoundErrorOctokitGraphql,
					mockJob,
					mockNextTask
				)
			).toBeTruthy();
		});

		it("handleNotFoundErrors should not continue sync for any other error response type", () => {
			expect(
				handleNotFoundErrors(
					mockOtherOctokitRequestErrors,
					mockJob,
					mockNextTask
				)
			).toBeFalsy();

			expect(
				handleNotFoundErrors(
					mockOtherOctokitGraphqlErrors,
					mockJob,
					mockNextTask
				)
			).toBeFalsy();

			expect(
				handleNotFoundErrors(
					mockOtherError,
					mockJob,
					mockNextTask
				)
			).toBeFalsy();

			expect(
				handleNotFoundErrors(
					null,
					mockJob,
					mockNextTask
				)
			).toBeFalsy();

			expect(
				handleNotFoundErrors(
					"",
					mockJob,
					mockNextTask
				)
			).toBeFalsy();
		});
	});
});

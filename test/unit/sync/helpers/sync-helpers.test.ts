import { mockNotFoundErrorOctokitGraphql, mockNotFoundErrorOctokitRequest, mockOtherError, mockOtherOctokitGraphqlErrors, mockOtherOctokitRequestErrors } from "../../../mocks/errorResponses";
/* eslint-disable @typescript-eslint/no-var-requires */
import {
	sortedRepos,
	isNotFoundError,
} from "../../../../src/sync/installation";
import {getLogger} from "../../../../src/config/logger";

jest.mock("../../../../src/models");

describe("Sync helpers suite", () => {
	const unsortedReposJson = require("../../../fixtures/repositories.json");
	const sortedReposJson = require("../../../fixtures/sorted-repos.json");

	it("sortedRepos should sort repos by updated_at", () => {
		expect(sortedRepos(unsortedReposJson)).toEqual(sortedReposJson);
	});

	describe("handleNotFoundErrors", () => {
		it("should continue sync if 404 status is sent in response from octokit/request", (): void => {
			// returns true if status is 404 so sync will continue
			expect(
				isNotFoundError(
					mockNotFoundErrorOctokitRequest,
					getLogger("test")
				)
			).toBeTruthy();
		});

		it("should continue sync if NOT FOUND error is sent in response from octokit/graphql", (): void => {
			// returns true if error object has type 'NOT_FOUND' so sync will continue
			expect(
				isNotFoundError(
					mockNotFoundErrorOctokitGraphql,
					getLogger("test")
				)
			).toBeTruthy();
		});

		it("handleNotFoundErrors should not continue sync for any other error response type", () => {
			expect(
				isNotFoundError(
					mockOtherOctokitRequestErrors,
					getLogger("test")
				)
			).toBeFalsy();

			expect(
				isNotFoundError(
					mockOtherOctokitGraphqlErrors,
					getLogger("test")
				)
			).toBeFalsy();

			expect(
				isNotFoundError(
					mockOtherError,
					getLogger("test")
				)
			).toBeFalsy();

			expect(
				isNotFoundError(
					null,
					getLogger("test")
				)
			).toBeFalsy();

			expect(
				isNotFoundError(
					"",
					getLogger("test")
				)
			).toBeFalsy();
		});
	});
});


import { generateCreatePullRequestUrl } from "../../../../src/transforms/util/gitHubPullRequestLinkGenerator";


describe("GitHub API Request Suite", () => {
	describe("generateCreatePullRequestUrl", () => {

		it("should", async () => {
			const BASE_URL = "github";
			const NAME = "branch-7";
			const ISSUE_KEYS = ["TEST-222"];
			const ISSUE_KEYS_FLAT = "TEST-222"
			const EXPECTED_RESULT = `github/compare/${NAME}?title=${ISSUE_KEYS_FLAT}%20${NAME}`;

			expect(generateCreatePullRequestUrl(BASE_URL, NAME, ISSUE_KEYS)).toBe(EXPECTED_RESULT);
		});

		it("should should", async () => {
			const BASE_URL = "github";
			const NAME = "branch-7";
			const ISSUE_KEYS = ["TEST-222", "TEST-111"];
			const ISSUE_KEYS_FLAT = "TEST-222%20TEST-111"
			const EXPECTED_RESULT = `github/compare/${NAME}?title=${ISSUE_KEYS_FLAT}%20${NAME}`;

			expect(generateCreatePullRequestUrl(BASE_URL, NAME, ISSUE_KEYS)).toBe(EXPECTED_RESULT);
		});

		it("should not", async () => {
			const BASE_URL = "github";
			const NAME = "branch-7";
			const ISSUE_KEYS = [];
			const EXPECTED_RESULT = `github/compare/${NAME}?title=${NAME}`;

			expect(generateCreatePullRequestUrl(BASE_URL, NAME, ISSUE_KEYS)).toBe(EXPECTED_RESULT);
		});
	})
})
import { generateCreatePullRequestUrl } from "../../../../src/transforms/util/pullRequestLinkGenerator";

describe("pullRequestLinkGenerator()", () => {

	it("should structure the url correctly with issue keys in title - for single issue key", async () => {
		const BASE_URL = "github";
		const NAME = "branch-7";
		const ISSUE_KEYS = ["TEST-222"];
		const ISSUE_KEYS_FLAT = "TEST-222"
		const EXPECTED_RESULT = `github/compare/${NAME}?title=${ISSUE_KEYS_FLAT}%20-%20${NAME}`;

		expect(generateCreatePullRequestUrl(BASE_URL, NAME, ISSUE_KEYS)).toBe(EXPECTED_RESULT);
	});

	it("should structure the url correctly with issue keys in title - for multiple issue keys", async () => {
		const BASE_URL = "github";
		const NAME = "branch-7";
		const ISSUE_KEYS = ["TEST-222", "TEST-111"];
		const ISSUE_KEYS_FLAT = "TEST-222%20TEST-111"
		const EXPECTED_RESULT = `github/compare/${NAME}?title=${ISSUE_KEYS_FLAT}%20-%20${NAME}`;

		expect(generateCreatePullRequestUrl(BASE_URL, NAME, ISSUE_KEYS)).toBe(EXPECTED_RESULT);
	});

	it("should only put name as title when no issue keys are available", async () => {
		const BASE_URL = "github";
		const NAME = "branch-7";
		const ISSUE_KEYS = [];
		const EXPECTED_RESULT = `github/compare/${NAME}?title=${NAME}`;

		expect(generateCreatePullRequestUrl(BASE_URL, NAME, ISSUE_KEYS)).toBe(EXPECTED_RESULT);
	});
})
import { generateCreatePullRequestUrl } from "./pull-request-link-generator";

describe("pullRequestLinkGenerator()", () => {

	it("should structure the url correctly with issue keys in title - for single issue key", async () => {
		const BASE_URL = "github";
		const NAME = "branch-7";
		const ISSUE_KEYS = ["TEST-222"];
		const EXPECTED_RESULT = `github/compare/branch-7?title=TEST-222%20-%20branch-7&quick_pull=1`;

		expect(generateCreatePullRequestUrl(BASE_URL, NAME, ISSUE_KEYS)).toBe(EXPECTED_RESULT);
	});

	it("should structure the url correctly with issue keys in title - for multiple issue keys", async () => {
		const BASE_URL = "github";
		const NAME = "branch-7";
		const ISSUE_KEYS = ["TEST-222", "TEST-111"];
		const EXPECTED_RESULT = `github/compare/branch-7?title=TEST-222%20TEST-111%20-%20branch-7&quick_pull=1`;

		expect(generateCreatePullRequestUrl(BASE_URL, NAME, ISSUE_KEYS)).toBe(EXPECTED_RESULT);
	});

	it("should only put name as title when no issue keys are available", async () => {
		const BASE_URL = "github";
		const NAME = "branch-7";
		const ISSUE_KEYS = [];
		const EXPECTED_RESULT = `github/compare/branch-7?title=branch-7&quick_pull=1`;

		expect(generateCreatePullRequestUrl(BASE_URL, NAME, ISSUE_KEYS)).toBe(EXPECTED_RESULT);
	});
});

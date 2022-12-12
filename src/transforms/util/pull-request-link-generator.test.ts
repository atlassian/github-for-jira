import { generateCreatePullRequestUrl } from "./pull-request-link-generator";

describe("pullRequestLinkGenerator()", () => {

	it("should structure the url only with issue key from branch - ignore others", async () => {
		const BASE_URL = "github";
		const NAME = "branch-7";
		const ISSUE_KEYS = ["TEST-222", "TEST-111"];
		const EXPECTED_RESULT = `github/compare/branch-7?title=branch-7&quick_pull=1`;

		expect(generateCreatePullRequestUrl(BASE_URL, NAME, ISSUE_KEYS)).toBe(EXPECTED_RESULT);
	});

	it("should structure the url only with the first issue key from issueKeys array if branch doesnt contain issue key", async () => {
		const BASE_URL = "github";
		const NAME = "branch-no-issue-key";
		const ISSUE_KEYS = Array.from(new Array(10)).map((_, i) => `TEST-${i}`);

		expect(generateCreatePullRequestUrl(BASE_URL, NAME, ISSUE_KEYS)).toBe("github/compare/branch-no-issue-key?title=TEST-0-branch-no-issue-key&quick_pull=1");
	});

	it("should only put name as title when no issue keys are available", async () => {
		const BASE_URL = "github";
		const NAME = "branch-7";
		const ISSUE_KEYS = [];
		const EXPECTED_RESULT = `github/compare/branch-7?title=branch-7&quick_pull=1`;

		expect(generateCreatePullRequestUrl(BASE_URL, NAME, ISSUE_KEYS)).toBe(EXPECTED_RESULT);
	});

	it("should return url without title query param if length > 2000", async () => {
		const BASE_URL = "github";
		const LONG_BRANCH_NAME = new Array(1950).join("X");
		const ISSUE_KEYS = ["TEST-222", "TEST-111"];
		const EXPECTED_RESULT = `github/compare/${LONG_BRANCH_NAME}`;

		expect(generateCreatePullRequestUrl(BASE_URL, LONG_BRANCH_NAME, ISSUE_KEYS)).toBe(EXPECTED_RESULT);
	});
});

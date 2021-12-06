import GitHubAPI from "../../../../src/config/github-api";
import { compareCommitsBetweenBaseAndHeadBranches } from "../../../../src/transforms/util/githubApiRequests";

describe("GitHub API Request Suite", () => {
	describe("compareCommitsBetweenBaseAndHeadBranches", () => {
		it.skip("should happy path", () => {
			const payload = {
				owner: "rachellerathbone",
				repo: "sandbox",
				base: "feature/TEST-101",
				head: "main",
			};

			// githubNock.get(`/repos/${payload.owner}/${payload.repo}/compare/${payload.base}${payload.head}`)
			// .reply(200, {
			// 	{},
			// 	"TEST"
			// });



			expect(
				compareCommitsBetweenBaseAndHeadBranches(payload, GitHubAPI())
			).toEqual("bob");
		});

		it("should unhappy path", () => {});
	});
});

// workflow-basic has pull request
// need to create a mock without


// test/unit/transforms/util/githubApiRequests.test.ts

/* eslint-disable @typescript-eslint/no-var-requires */
import GitHubAPI from "../../../../src/config/github-api";
import { getAllCommitMessagesBetweenReferences } from "../../../../src/transforms/util/githubApiRequests";
import { getLogger } from "../../../../src/config/logger";

describe("GitHub API Request Suite", () => {
	describe("compareCommitsBetweenBaseAndHeadBranches", () => {
		it("should return message from multiple commits containing multiple issue keys", async () => {
			const workflowRunPayload = Object.assign(
				{},
				require("../../../fixtures/workflow-basic.json")
			);

			const { pull_requests, repository } =
				workflowRunPayload.payload.workflow_run;

			const payload = {
				owner: repository.owner.login,
				repo: repository.name,
				base: pull_requests[0].base.ref,
				head: pull_requests[0].head.ref,
			};

			const pullRequestCommits = Object.assign(
				{},
				require("../../../fixtures/api/pull-request-multiple-commits-diff.json")
			);

			const { data } = pullRequestCommits;

			githubNock
				.get(
					`/repos/${payload.owner}/${payload.repo}/compare/${payload.base}...${payload.head}`
				)
				.reply(200, {
					...data,
				});

			const bob = await getAllCommitMessagesBetweenReferences(
				payload,
				GitHubAPI(),
				getLogger("test")
			);

			expect(bob).toEqual("TEST-117 TEST-89 edit TEST-109 TEST-11");
		});

		it("should return message with multiple issue keys for a single commit", async () => {
			const workflowRunPayload = Object.assign(
				{},
				require("../../../fixtures/workflow-basic.json")
			);

			const { pull_requests, repository } =
				workflowRunPayload.payload.workflow_run;

			const payload = {
				owner: repository.owner.login,
				repo: repository.name,
				base: pull_requests[0].base.ref,
				head: pull_requests[0].head.ref,
			};

			const pullRequestCommits = Object.assign(
				{},
				require("../../../fixtures/api/pull-request-single-commit-diff.json")
			);

			const data = pullRequestCommits.data;

			githubNock
				.get(
					`/repos/${payload.owner}/${payload.repo}/compare/${payload.base}...${payload.head}`
				)
				.reply(200, {
					...data,
				});

			const bob = await getAllCommitMessagesBetweenReferences(
				payload,
				GitHubAPI(),
				getLogger("test")
			);

			expect(bob).toEqual("my sole commit TEST-100");
		});
	});
});

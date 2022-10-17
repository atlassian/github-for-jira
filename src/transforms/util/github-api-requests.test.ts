import {
	extractMessagesFromCommitSummaries,
	getAllCommitMessagesBetweenReferences,
	getAllCommitsBetweenReferences
} from "~/src/transforms/util/github-api-requests";
import { getLogger } from "config/logger";
import workflowBasic from "fixtures/workflow-basic.json";
import pullRequestMultipleCommits from "fixtures/api/pull-request-multiple-commits-diff.json";
import pullRequestSingleCommit from "fixtures/api/pull-request-single-commit-diff.json";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { getInstallationId } from "~/src/github/client/installation-id";

describe("GitHub API Request Suite", () => {

	let gitHubInstallationClient: GitHubInstallationClient;

	const gitHubInstallationId = 123;
	beforeEach(() => {
		gitHubInstallationClient = new GitHubInstallationClient(getInstallationId(gitHubInstallationId), gitHubCloudConfig, getLogger("test"));
	});

	describe("compareCommitsBetweenBaseAndHeadBranches", () => {

		it("should return message from multiple commits containing multiple issue keys", async () => {
			githubUserTokenNock(gitHubInstallationId);
			const workflowRunPayload = Object.assign(
				{},
				workflowBasic
			);

			const { pull_requests, repository } =
				workflowRunPayload.payload.workflow_run;

			const payload = {
				owner: repository.owner.login,
				repo: repository.name,
				base: pull_requests[0].base.ref,
				head: pull_requests[0].head.ref
			};

			const pullRequestCommits = Object.assign(
				{},
				pullRequestMultipleCommits
			);

			const { data } = pullRequestCommits;

			githubUserTokenNock(gitHubInstallationId);
			githubNock
				.get(
					`/repos/${payload.owner}/${payload.repo}/compare/${payload.base}...${payload.head}`
				)
				.reply(200, {
					...data
				});

			const bob = await getAllCommitMessagesBetweenReferences(
				payload,
				gitHubInstallationClient,
				getLogger("test")
			);

			expect(bob).toEqual("TEST-117 TEST-89 edit TEST-109 TEST-11");
		});

		it("should return message with multiple issue keys for a single commit", async () => {
			githubUserTokenNock(gitHubInstallationId);
			const workflowRunPayload = Object.assign(
				{},
				workflowBasic
			);

			const { pull_requests, repository } =
				workflowRunPayload.payload.workflow_run;

			const payload = {
				owner: repository.owner.login,
				repo: repository.name,
				base: pull_requests[0].base.ref,
				head: pull_requests[0].head.ref
			};

			const pullRequestCommits = Object.assign(
				{},
				pullRequestSingleCommit
			);

			const data = pullRequestCommits.data;

			githubUserTokenNock(gitHubInstallationId);
			githubNock
				.get(
					`/repos/${payload.owner}/${payload.repo}/compare/${payload.base}...${payload.head}`
				)
				.reply(200, {
					...data
				});

			const bob = await getAllCommitMessagesBetweenReferences(
				payload,
				gitHubInstallationClient,
				getLogger("test")
			);

			expect(bob).toEqual("my sole commit TEST-100");
		});
	});

	describe("getAllCommitsBetweenReferences", () => {
		it("should return message from multiple commits containing multiple issue keys", async () => {

			githubUserTokenNock(gitHubInstallationId);
			const workflowRunPayload = Object.assign(
				{},
				workflowBasic
			);

			const { pull_requests, repository } =
				workflowRunPayload.payload.workflow_run;

			const payload = {
				owner: repository.owner.login,
				repo: repository.name,
				base: pull_requests[0].base.ref,
				head: pull_requests[0].head.ref
			};

			const pullRequestCommits = Object.assign(
				{},
				pullRequestMultipleCommits
			);

			const { data } = pullRequestCommits;

			githubUserTokenNock(gitHubInstallationId);
			githubNock
				.get(
					`/repos/${payload.owner}/${payload.repo}/compare/${payload.base}...${payload.head}`
				)
				.reply(200, {
					...data
				});

			const bob = await getAllCommitsBetweenReferences(
				payload,
				gitHubInstallationClient,
				getLogger("test")
			);

			expect(bob).toEqual([
				{
					sha: "2jkrnw9pidfnew89fn2903rnpfwjdfndsf",
					message: "TEST-117 TEST-89 edit"
				},
				{
					sha: "2jkrnw9pidfnew89fn2903rnpfwjdfndsf",
					message: "TEST-109"
				},
				{
					sha: "2jkrnw9pidfnew89fn2903rnpfwjdfndsf",
					message: "TEST-11"
				}
			]);
		});

		it.skip("should return message with multiple issue keys for a single commit", async () => {
			const workflowRunPayload = Object.assign(
				{},
				workflowBasic
			);

			const { pull_requests, repository } =
				workflowRunPayload.payload.workflow_run;

			const payload = {
				owner: repository.owner.login,
				repo: repository.name,
				base: pull_requests[0].base.ref,
				head: pull_requests[0].head.ref
			};

			const pullRequestCommits = Object.assign(
				{},
				pullRequestSingleCommit
			);

			const data = pullRequestCommits.data;

			githubUserTokenNock(gitHubInstallationId);
			githubNock
				.get(
					`/repos/${payload.owner}/${payload.repo}/compare/${payload.base}...${payload.head}`
				)
				.reply(200, {
					...data
				});

			const bob = await getAllCommitsBetweenReferences(
				payload,
				gitHubInstallationClient,
				getLogger("test")
			);

			expect(bob).toEqual([
				{
					sha: "2jkrnw9pidfnew89fn2903rnpfwjdfndsf",
					message: "my sole commit TEST-100"
				}
			]);
		});
	});

	describe("extractMessagesFromCommitSummaries", () => {
		it("should extract the concatenated message from multiple commit summaries", async () => {
			const bob = await extractMessagesFromCommitSummaries(
				[
					{
						sha: "2jkrnw9pidfnew89fn2903rnpfwjdfndsf",
						message: "TEST-117 TEST-89 edit"
					},
					{
						sha: "2jkrnw9pidfnew89fn2903rnpfwjdfndsf",
						message: "TEST-109"
					},
					{
						sha: "2jkrnw9pidfnew89fn2903rnpfwjdfndsf",
						message: "TEST-11"
					}
				]);

			expect(bob).toEqual("TEST-117 TEST-89 edit TEST-109 TEST-11");
		});
	});
});

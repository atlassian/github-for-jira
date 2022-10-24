/* eslint-disable @typescript-eslint/no-explicit-any */
import { transformPullRequest } from "./transform-pull-request";
import transformPullRequestList from "fixtures/api/transform-pull-request-list.json";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { getInstallationId } from "~/src/github/client/installation-id";
import { getLogger } from "config/logger";

describe("pull_request transform", () => {
	const gitHubInstallationId = 100403908;
	let client: GitHubInstallationClient;

	beforeEach(() => {
		mockSystemTime(12345678);
		client = new GitHubInstallationClient(getInstallationId(gitHubInstallationId), gitHubCloudConfig, getLogger("test"));
	});

	it("should not contain branches on the payload if pull request status is closed.", async () => {
		const fixture = transformPullRequestList[0];
		fixture.title = "[TES-123] Branch payload Test";

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/users/${fixture.user.login}`)
			.reply(200, {
				...fixture.user,
				name: "Some User Name"
			});

		const data = await transformPullRequest(client, fixture as any);

		const { updated_at, title } = fixture;

		expect(data).toMatchObject({
			id: "100403908",
			name: "integrations/test",
			pullRequests: [
				{
					author: {
						avatar: "https://avatars0.githubusercontent.com/u/173?v=4",
						name: "Some User Name",
						url: "https://api.github.com/users/bkeepers"
					},
					destinationBranch: "devel",
					destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
					displayId: "#51",
					id: 51,
					issueKeys: ["TES-123"],
					lastUpdate: updated_at,
					sourceBranch: "use-the-force",
					sourceBranchUrl:
						"https://github.com/integrations/test/tree/use-the-force",
					status: "MERGED",
					timestamp: updated_at,
					title: title,
					url: "https://github.com/integrations/test/pull/51",
					updateSequenceId: 12345678
				}
			],
			url: "https://github.com/integrations/test",
			updateSequenceId: 12345678
		});
	});

	it("should contain branches on the payload if pull request status is different than closed.", async () => {
		const pullRequestList = Object.assign({},
			transformPullRequestList
		);

		const fixture = pullRequestList[1];
		fixture.title = "[TES-123] Branch payload Test";

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/users/${fixture.user.login}`)
			.reply(200, {
				...fixture.user,
				name: "Some User Name"
			});

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/users/${fixture.head.user.login}`)
			.reply(200, {
				...fixture.head.user,
				name: "Last Commit User Name"
			});

		const data = await transformPullRequest(client, fixture as any);

		const { updated_at, title } = fixture;

		expect(data).toMatchObject({
			id: "100403908",
			name: "integrations/test",
			pullRequests: [
				{
					author: {
						avatar: "https://avatars0.githubusercontent.com/u/173?v=4",
						name: "Some User Name",
						url: "https://api.github.com/users/bkeepers"
					},
					destinationBranch: "devel",
					destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
					displayId: "#51",
					id: 51,
					issueKeys: ["TES-123"],
					lastUpdate: updated_at,
					sourceBranch: "use-the-force",
					sourceBranchUrl:
						"https://github.com/integrations/test/tree/use-the-force",
					status: "OPEN",
					timestamp: updated_at,
					title: title,
					url: "https://github.com/integrations/test/pull/51",
					updateSequenceId: 12345678
				}
			],
			branches: [
				{
					createPullRequestUrl:
						"https://github.com/integrations/test/compare/use-the-force?title=TES-123-use-the-force&quick_pull=1",
					id: "use-the-force",
					issueKeys: ["TES-123"],
					lastCommit: {
						author: {
							avatar: "https://avatars3.githubusercontent.com/u/31044959?v=4",
							name: "Last Commit User Name",
							url: "https://github.com/integrations"
						},
						authorTimestamp: "2018-05-04T14:06:56Z",
						displayId: "09ca66",
						fileCount: 0,
						hash: "09ca669e4b5ff78bfa6a9fee74c384812e1f96dd",
						id: "09ca669e4b5ff78bfa6a9fee74c384812e1f96dd",
						issueKeys: ["TES-123"],
						message: "n/a",
						updateSequenceId: 12345678,
						url: "https://github.com/integrations/test/commit/09ca669e4b5ff78bfa6a9fee74c384812e1f96dd"
					},
					name: "use-the-force",
					updateSequenceId: 12345678,
					url: "https://github.com/integrations/test/tree/use-the-force"
				}
			],
			url: "https://github.com/integrations/test",
			updateSequenceId: 12345678
		});
	});

	it("should not contain createPullRequestUrl on the payload if length > 2000", async () => {
		const pullRequestList = Object.assign({},
			transformPullRequestList
		);

		const fixture = pullRequestList[2];
		fixture.title = "[TEST-0] Branch payload with loads of issue keys Test";

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/users/${fixture.user.login}`)
			.reply(200, {
				...fixture.user,
				name: "Some User Name"
			});

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/users/${fixture.head.user.login}`)
			.reply(200, {
				...fixture.head.user,
				name: "Last Commit User Name"
			});

		const data = await transformPullRequest(client, fixture as any);

		const { updated_at, title } = fixture;

		const issueKeys = Array.from(new Array(250)).map((_, i) => `TEST-${i}`);

		expect(data).toMatchObject({
			id: "100403908",
			name: "integrations/test",
			pullRequests: [
				{
					author: {
						avatar: "https://avatars0.githubusercontent.com/u/173?v=4",
						name: "Some User Name",
						url: "https://api.github.com/users/bkeepers"
					},
					destinationBranch: "devel",
					destinationBranchUrl: "https://github.com/integrations/test/tree/devel",
					displayId: "#51",
					id: 51,
					issueKeys,
					lastUpdate: updated_at,
					sourceBranch: "use-the-force",
					sourceBranchUrl:
						"https://github.com/integrations/test/tree/use-the-force",
					status: "OPEN",
					timestamp: updated_at,
					title: title,
					url: "https://github.com/integrations/test/pull/51",
					updateSequenceId: 12345678
				}
			],
			branches: [
				{
					id: "use-the-force",
					issueKeys,
					lastCommit: {
						author: {
							avatar: "https://avatars3.githubusercontent.com/u/31044959?v=4",
							name: "Last Commit User Name",
							url: "https://github.com/integrations"
						},
						authorTimestamp: "2018-05-04T14:06:56Z",
						displayId: "09ca66",
						fileCount: 0,
						hash: "09ca669e4b5ff78bfa6a9fee74c384812e1f96dd",
						id: "09ca669e4b5ff78bfa6a9fee74c384812e1f96dd",
						issueKeys,
						message: "n/a",
						updateSequenceId: 12345678,
						url: "https://github.com/integrations/test/commit/09ca669e4b5ff78bfa6a9fee74c384812e1f96dd"
					},
					name: "use-the-force",
					updateSequenceId: 12345678,
					url: "https://github.com/integrations/test/tree/use-the-force"
				}
			],
			url: "https://github.com/integrations/test",
			updateSequenceId: 12345678
		});
	});
});

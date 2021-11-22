import { RateLimitingError } from './../../../src/config/enhance-octokit';
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/no-standalone-expect */

import { getLogger } from "../../../src/config/logger";
import GitHubClient from "../../../src/github/client/github-client";
import statsd from '../../../src/config/statsd';

describe("GitHub Client", () => {
	const appTokenExpirationDate = new Date(2021, 10, 25, 0, 0);
	const githubInstallationId = 17979017;
	let statsdHistogramSpy
	beforeEach(() => {
		// Lock Time
		statsdHistogramSpy = jest.spyOn(statsd, "histogram");
		jest.useFakeTimers("modern").setSystemTime(1000000);
	});

	afterEach(() => {
		// Unlock Time
		statsdHistogramSpy.mockRestore();
		jest.useRealTimers();
	});

	function givenGitHubReturnsInstallationToken(
		installationToken: string,
		expectedAppTokenInHeader?: string
	) {
		githubNock
			.post(`/app/installations/${githubInstallationId}/access_tokens`)
			.matchHeader(
				"Authorization",
				expectedAppTokenInHeader
					? `Bearer ${expectedAppTokenInHeader}`
					: /^Bearer .+$/
			)
			.matchHeader("Accept", "application/vnd.github.v3+json")
			.reply(200, {
				expires_at: appTokenExpirationDate.toISOString(),
				token: installationToken,
			});
	}

	function givenGitHubReturnsPullrequests(
		owner: string,
		repo: string,
		perPage: number,
		page: number,
		expectedInstallationTokenInHeader?: string
	) {
		githubNock
			.get(`/repos/${owner}/${repo}/pulls`)
			.query({
				per_page: perPage,
				page,
				installationId: /^.*$/,
			})
			.matchHeader(
				"Authorization",
				expectedInstallationTokenInHeader
					? `Bearer ${expectedInstallationTokenInHeader}`
					: /^Bearer .+$/
			)
			.matchHeader("Accept", "application/vnd.github.v3+json")
			.reply(200, [
				{ number: 1 }, // we don't really care about the shape of this response because it's in GitHub's hands anyways
			]);
	}

	it("lists pull requests", async () => {
		const owner = "owner";
		const repo = "repo";
		const pageSize = 5;
		const page = 1;

		givenGitHubReturnsInstallationToken("installation token");
		givenGitHubReturnsPullrequests(
			owner,
			repo,
			pageSize,
			page,
			"installation token"
		);

		const client = new GitHubClient(githubInstallationId, getLogger("test"));
		const pullrequests = await client.getPullRequests(owner, repo, {
			per_page: pageSize,
			page,
		});

		expect(pullrequests).toBeTruthy();
		expect(githubNock.pendingMocks()).toEqual([]);
	});

	it("should handle rate limit error from Github", async () => {
		githubNock.get(`/repos/owner/repo/pulls`).reply(
			403, [{ number: 1 }],
			{
				"X-RateLimit-Remaining": "0",
			}
		);
		const client = new GitHubClient(githubInstallationId, getLogger("test"));
		expect(client.getPullRequests("owner", "repo", {}))
			.toThrow(new RateLimitingError(1360))	
	});
});

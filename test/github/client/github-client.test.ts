/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/no-standalone-expect */

import { getLogger } from "../../../src/config/logger";
import GitHubClient from "../../../src/github/client/github-client";
import statsd from "../../../src/config/statsd";
import {BlockedIpError, GithubClientError, RateLimitingError} from "../../../src/github/client/errors";
import anything = jasmine.anything;
import objectContaining = jasmine.objectContaining;

describe("GitHub Client", () => {
	const appTokenExpirationDate = new Date(2021, 10, 25, 0, 0);
	const githubInstallationId = 17979017;
	let statsdHistogramSpy, statsdIncrementSpy;
	beforeEach(() => {
		// Lock Time
		statsdHistogramSpy = jest.spyOn(statsd, "histogram");
		statsdIncrementSpy = jest.spyOn(statsd, "increment");
	});

	afterEach(() => {
		// Unlock Time
		statsdHistogramSpy.mockRestore();
	});

	function givenGitHubReturnsInstallationToken(
		installationToken: string,
		expectedAppTokenInHeader?: string
	) {
		githubNock
			.post(`/app/installations/${githubInstallationId}/access_tokens`)
			.optionally()
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

	function givenGitHubReturnsCommit(
		owner: string,
		repo: string,
		ref: string,
		expectedInstallationTokenInHeader?: string
	) {
		githubNock
			.get(`/repos/${owner}/${repo}/commits/${ref}`)
			.query({
				installationId: /^.*$/
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
		verifyMetricsSent('/repos/:owner/:repo/pulls', "200");
	});

	it("fetches a commit", async () => {
		const owner = "owner";
		const repo = "repo";
		const sha = "84fdc9346f43f829f88fb4b1d240b1aaaa5250da";

		givenGitHubReturnsInstallationToken("installation token");
		givenGitHubReturnsCommit(
			owner,
			repo,
			sha,
			"installation token"
		);

		const client = new GitHubClient(githubInstallationId, getLogger("test"));
		const commit = await client.getCommit(owner, repo, sha);

		expect(commit).toBeTruthy();
		expect(githubNock.pendingMocks()).toEqual([]);
		verifyMetricsSent('/repos/:owner/:repo/commits/:ref', "200");
	});

	function verifyMetricsSent(path: string, status) {
		expect(statsdHistogramSpy).toBeCalledWith("app.server.http.request.github", anything(), objectContaining({
			client: "axios",
			method: 'GET',
			path,
			status
		}));
	}

	it("should handle rate limit error from Github when X-RateLimit-Reset not specified", async () => {
		givenGitHubReturnsInstallationToken("installation token");
		githubNock.get(`/repos/owner/repo/pulls`).query({
			installationId: /^.*$/,
		}).reply(
			403, { message: "API rate limit exceeded for xxx.xxx.xxx.xxx." },
			{
				"X-RateLimit-Remaining": "0",
			}
		);
		Date.now = jest.fn(() => 1000000);
		const client = new GitHubClient(githubInstallationId, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(RateLimitingError)
		expect(error.rateLimitReset).toBe(4600)

		verifyMetricsSent('/repos/:owner/:repo/pulls', "rateLimiting");

	});

	it("should handle rate limit error from Github when X-RateLimit-Reset specified", async () => {
		givenGitHubReturnsInstallationToken("installation token");
		githubNock.get(`/repos/owner/repo/pulls`).query({
			installationId: /^.*$/,
		}).reply(
			403, [{ number: 1 }],
			{
				"X-RateLimit-Remaining": "0",
				"X-RateLimit-Reset": "2000"
			}
		);
		Date.now = jest.fn(() => 1000000);
		const client = new GitHubClient(githubInstallationId, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(RateLimitingError)
		expect(error.rateLimitReset).toBe(2000)

		verifyMetricsSent('/repos/:owner/:repo/pulls', "rateLimiting");

	});

	it("should handle blocked IP error from Github when specified", async () => {
		givenGitHubReturnsInstallationToken("installation token");
		githubNock.get(`/repos/owner/repo/pulls`).query({
			installationId: /^.*$/,
		}).reply(
			403, { message: "Org has an IP allow list enabled" }
		);
		Date.now = jest.fn(() => 1000000);
		const client = new GitHubClient(githubInstallationId, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(BlockedIpError);
		expect(statsdIncrementSpy).toBeCalledWith("app.server.error.blocked-by-github-allowlist");
		verifyMetricsSent('/repos/:owner/:repo/pulls', "blockedIp");
	});

	it("should handle rate limit properly handled regardless of the response code", async () => {
		givenGitHubReturnsInstallationToken("installation token");
		githubNock.get(`/repos/owner/repo/pulls`).query({
			installationId: /^.*$/,
		}).reply(
			500, [{ number: 1 }],
			{
				"X-RateLimit-Remaining": "0",
				"X-RateLimit-Reset": "2000"
			}
		);
		Date.now = jest.fn(() => 1000000);
		const client = new GitHubClient(githubInstallationId, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(RateLimitingError)
		expect(error.rateLimitReset).toBe(2000)

		verifyMetricsSent('/repos/:owner/:repo/pulls', "rateLimiting");

	});

	it("should transform error properly on 404", async () => {
		givenGitHubReturnsInstallationToken("installation token");
		githubNock.get(`/repos/owner/repo/pulls`).query({
			installationId: /^.*$/,
		}).reply(
			404, [{ number: 1 }],
			{
				"X-RateLimit-Remaining": "0",
			}
		);
		Date.now = jest.fn(() => 1000000);
		const client = new GitHubClient(githubInstallationId, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(GithubClientError)
		expect(error.status).toBe(404)

		verifyMetricsSent('/repos/:owner/:repo/pulls', "404");
	});
});

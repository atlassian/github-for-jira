/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/no-standalone-expect */

import { getLogger } from "../../../src/config/logger";
import GitHubClient from "../../../src/github/client/github-client";
import statsd from '../../../src/config/statsd';
import {GithubClientError, RateLimitingError} from "../../../src/github/client/errors";
import anything = jasmine.anything;
import objectContaining = jasmine.objectContaining;

describe("GitHub Client", () => {
	const appTokenExpirationDate = new Date(2021, 10, 25, 0, 0);
	const githubInstallationId = 17979017;
	let statsdHistogramSpy
	beforeEach(() => {
		// Lock Time
		statsdHistogramSpy = jest.spyOn(statsd, "histogram");
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
		verifyMetricsSent("200");
	});

	function verifyMetricsSent(status) {
		expect(statsdHistogramSpy).toBeCalledWith("app.server.http.request.github", anything(), objectContaining({
			client: "axios",
			method: 'GET',
			path: '/repos/:owner/:repo/pulls',
			status
		}));
	}

	it("should handle rate limit error from Github when X-RateLimit-Reset not specified", async () => {
		givenGitHubReturnsInstallationToken("installation token");
		githubNock.get(`/repos/owner/repo/pulls`).query({
			installationId: /^.*$/,
		}).reply(
			403, [{ number: 1 }],
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

		verifyMetricsSent("rateLimiting");

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

		verifyMetricsSent("rateLimiting");

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

		verifyMetricsSent("rateLimiting");

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

		verifyMetricsSent("404");
	});
});

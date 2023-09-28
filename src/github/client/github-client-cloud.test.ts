import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "./github-installation-client";
import { statsd }  from "config/statsd";
import { GithubClientBlockedIpError, GithubClientError, GithubClientTimeoutError, GithubClientRateLimitingError } from "./github-client-errors";
import { getInstallationId } from "./installation-id";
import nock from "nock";
import { when } from "jest-when";
import { numberFlag, NumberFlags } from "config/feature-flags";

jest.mock("config/feature-flags");

describe("GitHub Client", () => {
	const githubInstallationId = 17979017;
	let statsdHistogramSpy: jest.SpyInstance, statsdIncrementSpy: jest.SpyInstance;
	beforeEach(() => {
		// Lock Time
		statsdHistogramSpy = jest.spyOn(statsd, "histogram");
		statsdIncrementSpy = jest.spyOn(statsd, "increment");
	});

	afterEach(() => {
		// Unlock Time
		statsdHistogramSpy.mockRestore();
	});

	const givenGitHubReturnsPullrequests = (
		owner: string,
		repo: string,
		perPage: number,
		page: number,
		expectedInstallationTokenInHeader?: string,
		scope: nock.Scope = githubNock
	) => {
		scope
			.get(`/repos/${owner}/${repo}/pulls`)
			.query({
				per_page: perPage,
				page,
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
				{ number: 1 } // we don't really care about the shape of this response because it's in GitHub's hands anyways
			]);
	};

	const givenGitHubReturnsCommit = (
		owner: string,
		repo: string,
		ref: string,
		expectedInstallationTokenInHeader?: string,
		scope: nock.Scope = githubNock
	) => {
		scope
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
				{ number: 1 } // we don't really care about the shape of this response because it's in GitHub's hands anyways
			]);
	};


	it("lists pull requests", async () => {
		const owner = "owner";
		const repo = "repo";
		const pageSize = 5;
		const page = 1;

		githubUserTokenNock(githubInstallationId, "installation token");
		givenGitHubReturnsPullrequests(
			owner,
			repo,
			pageSize,
			page,
			"installation token"
		);

		const client = new GitHubInstallationClient(getInstallationId(githubInstallationId), gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"));
		const pullrequests = await client.getPullRequests(owner, repo, {
			per_page: pageSize,
			page
		});

		expect(pullrequests).toBeTruthy();
		verifyMetricsSent("/repos/{owner}/{repo}/pulls", "200");
	});

	it("fetches a commit", async () => {
		const owner = "owner";
		const repo = "repo";
		const sha = "84fdc9346f43f829f88fb4b1d240b1aaaa5250da";

		githubUserTokenNock(githubInstallationId, "installation token");
		givenGitHubReturnsCommit(
			owner,
			repo,
			sha,
			"installation token"
		);

		const client = new GitHubInstallationClient(getInstallationId(githubInstallationId), gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"));
		const commit = await client.getCommit(owner, repo, sha);

		expect(commit).toBeTruthy();
		verifyMetricsSent("/repos/{owner}/{repo}/commits/{ref}", "200");
	});

	const verifyMetricsSent = (path: string, status: string) => {
		expect(statsdHistogramSpy).toBeCalledWith("app.server.http.request.github", expect.anything(), expect.objectContaining({
			client: "axios",
			gitHubProduct: "cloud",
			method: "GET",
			path,
			status
		}), { jiraHost });
	};

	const verifyMetricStatus = (status: string) => {
		expect(statsdHistogramSpy).toBeCalledWith("app.server.http.request.github", expect.anything(), expect.objectContaining({
			client: "axios",
			gitHubProduct: "cloud",
			status
		}), { jiraHost });
	};


	it("should handle rate limit error from Github when X-RateLimit-Reset not specified", async () => {
		githubUserTokenNock(githubInstallationId, "installation token");
		githubNock.get(`/repos/owner/repo/pulls`).query({
			installationId: /^.*$/
		}).reply(
			403, { message: "API rate limit exceeded for xxx.xxx.xxx.xxx." },
			{
				"X-RateLimit-Remaining": "0"
			}
		);
		mockSystemTime(1000000);
		const client = new GitHubInstallationClient(getInstallationId(githubInstallationId), gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e: unknown) {
			error = e;
		}

		expect(error).toBeInstanceOf(GithubClientRateLimitingError);
		expect(error.rateLimitReset).toBe(4600);

		verifyMetricsSent("/repos/{owner}/{repo}/pulls", "rateLimiting");

	});

	it("should handle rate limit error from Github when X-RateLimit-Reset specified", async () => {
		githubUserTokenNock(githubInstallationId, "installation token");
		githubNock.get(`/repos/owner/repo/pulls`).query({
			installationId: /^.*$/
		}).reply(
			403, [{ number: 1 }],
			{
				"X-RateLimit-Remaining": "0",
				"X-RateLimit-Reset": "2000"
			}
		);
		mockSystemTime(1000000);
		const client = new GitHubInstallationClient(getInstallationId(githubInstallationId), gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e: unknown) {
			error = e;
		}

		expect(error).toBeInstanceOf(GithubClientRateLimitingError);
		expect(error.rateLimitReset).toBe(2000);

		verifyMetricsSent("/repos/{owner}/{repo}/pulls", "rateLimiting");

	});

	it("should handle blocked IP error from Github when specified", async () => {
		githubUserTokenNock(githubInstallationId, "installation token");
		githubNock.get(`/repos/owner/repo/pulls`).query({
			installationId: /^.*$/
		}).reply(
			403, { message: "Org has an IP allow list enabled" }
		);
		mockSystemTime(1000000);
		const client = new GitHubInstallationClient(getInstallationId(githubInstallationId), gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e: unknown) {
			error = e;
		}

		expect(error).toBeInstanceOf(GithubClientBlockedIpError);
		expect(statsdIncrementSpy).toBeCalledWith("app.server.error.blocked-by-github-allowlist", { gitHubProduct: "cloud" }, { jiraHost });
		verifyMetricsSent("/repos/{owner}/{repo}/pulls", "blockedIp");
	});

	it("should handle rate limit on 403", async () => {
		githubUserTokenNock(githubInstallationId, "installation token");
		githubNock.get(`/repos/owner/repo/pulls`).query({
			installationId: /^.*$/
		}).reply(
			403, [{ number: 1 }],
			{
				"X-RateLimit-Remaining": "0",
				"X-RateLimit-Reset": "2000"
			}
		);
		mockSystemTime(1000000);
		const client = new GitHubInstallationClient(getInstallationId(githubInstallationId), gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e: unknown) {
			error = e;
		}

		expect(error).toBeInstanceOf(GithubClientRateLimitingError);
		expect(error.rateLimitReset).toBe(2000);

		verifyMetricsSent("/repos/{owner}/{repo}/pulls", "rateLimiting");

	});

	it("should transform error properly on 404", async () => {
		githubUserTokenNock(githubInstallationId, "installation token");
		githubNock.get(`/repos/owner/repo/pulls`).query({
			installationId: /^.*$/
		}).reply(
			404, [{ number: 1 }],
			{
				"X-RateLimit-Remaining": "0"
			}
		);
		mockSystemTime(1000000);
		const client = new GitHubInstallationClient(getInstallationId(githubInstallationId), gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e: unknown) {
			error = e;
		}

		expect(error).toBeInstanceOf(GithubClientError);
		expect(error.status).toBe(404);

		verifyMetricsSent("/repos/{owner}/{repo}/pulls", "404");
	});

	it("should throw timeout exception if request took longer than timeout", async () => {

		when(numberFlag).calledWith(
			NumberFlags.GITHUB_CLIENT_TIMEOUT,
			expect.anything()
		).mockResolvedValue(100);

		githubUserTokenNock(githubInstallationId, "installation token");
		githubNock.get(`/repos/owner/repo/pulls`).query({
			installationId: /^.*$/
		}).delay(2000).reply(
			200, [{ number: 1 }]
		);

		const client = new GitHubInstallationClient(getInstallationId(githubInstallationId), gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e: unknown) {
			error = e;
		}

		expect(error).toBeInstanceOf(GithubClientTimeoutError);

		verifyMetricStatus("timeout");

	});

});

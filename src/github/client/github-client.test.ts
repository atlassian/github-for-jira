/* eslint-disable jest/no-standalone-expect */
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "./github-installation-client";
import { statsd }  from "config/statsd";
import { BlockedIpError, GithubClientError, GithubClientTimeoutError, RateLimitingError } from "./github-client-errors";
import { getCloudInstallationId, InstallationId } from "./installation-id";
import nock from "nock";
import { AppTokenHolder } from "./app-token-holder";
import fs from "fs";
import { envVars }  from "config/env";
import { when } from "jest-when";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { GITHUB_ENTERPRISE_CLOUD_BASEURL } from "utils/check-github-app-type";

jest.mock("config/feature-flags");

describe("GitHub Client", () => {
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

	function givenGitHubReturnsPullrequests(
		owner: string,
		repo: string,
		perPage: number,
		page: number,
		expectedInstallationTokenInHeader?: string,
		scope: nock.Scope = githubNock
	) {
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
	}

	function givenGitHubReturnsCommit(
		owner: string,
		repo: string,
		ref: string,
		expectedInstallationTokenInHeader?: string,
		scope: nock.Scope = githubNock
	) {
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
	}


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

		const client = new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, GITHUB_ENTERPRISE_CLOUD_BASEURL), GITHUB_ENTERPRISE_CLOUD_BASEURL, getLogger("test"));
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

		const client = new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, GITHUB_ENTERPRISE_CLOUD_BASEURL), GITHUB_ENTERPRISE_CLOUD_BASEURL, getLogger("test"));
		const commit = await client.getCommit(owner, repo, sha);

		expect(commit).toBeTruthy();
		verifyMetricsSent("/repos/{owner}/{repo}/commits/{ref}", "200");
	});

	function verifyMetricsSent(path: string, status) {
		expect(statsdHistogramSpy).toBeCalledWith("app.server.http.request.github", expect.anything(), expect.objectContaining({
			client: "axios",
			method: "GET",
			path,
			status
		}));
	}

	function verifyMetricStatus(status) {
		expect(statsdHistogramSpy).toBeCalledWith("app.server.http.request.github", expect.anything(), expect.objectContaining({
			client: "axios",
			status
		}));
	}


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
		const client = new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, GITHUB_ENTERPRISE_CLOUD_BASEURL), GITHUB_ENTERPRISE_CLOUD_BASEURL, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(RateLimitingError);
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
		const client = new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, GITHUB_ENTERPRISE_CLOUD_BASEURL), GITHUB_ENTERPRISE_CLOUD_BASEURL, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(RateLimitingError);
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
		const client = new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, GITHUB_ENTERPRISE_CLOUD_BASEURL), GITHUB_ENTERPRISE_CLOUD_BASEURL, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(BlockedIpError);
		expect(statsdIncrementSpy).toBeCalledWith("app.server.error.blocked-by-github-allowlist");
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
		const client = new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, GITHUB_ENTERPRISE_CLOUD_BASEURL), GITHUB_ENTERPRISE_CLOUD_BASEURL, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(RateLimitingError);
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
		const client = new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, GITHUB_ENTERPRISE_CLOUD_BASEURL), GITHUB_ENTERPRISE_CLOUD_BASEURL, getLogger("test"));
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(GithubClientError);
		expect(error.status).toBe(404);

		verifyMetricsSent("/repos/{owner}/{repo}/pulls", "404");
	});

	/**
	 * One test against a non-cloud GitHub URL to prove that the client will be working against an on-premise
	 * GHE installation.
	 */
	it.skip("works with a non-cloud installation", async () => {
		const owner = "owner";
		const repo = "repo";
		const pageSize = 5;
		const page = 1;

		gheUserTokenNock(githubInstallationId, "installation token");
		givenGitHubReturnsPullrequests(
			owner,
			repo,
			pageSize,
			page,
			"installation token",
			gheNock
		);

		const appTokenHolder = new AppTokenHolder((installationId: InstallationId) => {
			switch (installationId.githubBaseUrl) {
				case gheUrl:
					return fs.readFileSync(envVars.PRIVATE_KEY_PATH, { encoding: "utf8" });
				default:
					throw new Error("unknown github instance!");
			}
		});

		const client = new GitHubInstallationClient(
			new InstallationId(gheUrl, 4711, githubInstallationId),
			"https://github.mydomain.com",
			getLogger("test"),
			appTokenHolder
		);
		const pullrequests = await client.getPullRequests(owner, repo, {
			per_page: pageSize,
			page
		});

		expect(pullrequests).toBeTruthy();
		verifyMetricsSent("/repos/{owner}/{repo}/pulls", "200");
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

		const client = await new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, GITHUB_ENTERPRISE_CLOUD_BASEURL), GITHUB_ENTERPRISE_CLOUD_BASEURL, getLogger("test"), AppTokenHolder.getInstance());
		let error: any = undefined;
		try {
			await client.getPullRequests("owner", "repo", {});
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(GithubClientTimeoutError);

		verifyMetricStatus("timeout");

	});

});

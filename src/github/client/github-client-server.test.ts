/* eslint-disable jest/no-standalone-expect */
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "./github-installation-client";
import { statsd }  from "config/statsd";
import { InstallationId } from "./installation-id";
import nock from "nock";
import { AppTokenHolder } from "./app-token-holder";
import fs from "fs";
import { envVars }  from "config/env";
import { GitHubClientConfig } from "utils/get-github-client-config";
jest.mock("config/feature-flags");

describe("GitHub Client", () => {
	const githubInstallationId = 17979017;
	let statsdHistogramSpy;

	beforeEach(() => {
		// Lock Time
		statsdHistogramSpy = jest.spyOn(statsd, "histogram");
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
			.matchHeader("Accept", "application/vnd.github.machine-man-preview+json")
			.reply(200, [
				{ number: 1 } // we don't really care about the shape of this response because it's in GitHub's hands anyways
			])
	}

	function verifyMetricsSent(path: string, status) {
		expect(statsdHistogramSpy).toBeCalledWith("app.server.http.request.github", expect.anything(), expect.objectContaining({
			client: "axios",
			method: "GET",
			path,
			status
		}));
	}

	it("works with a non-cloud installation", async () => {
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
					throw new Error("unknown GitHub instance!");
			}
		});

		const gitHubClientConfig: GitHubClientConfig = {
			hostname: "https://github.mydomain.com",
			apiBaseUrl: "https://github.mydomain.com/api/v3",
			acceptHeader: "application/vnd.github.machine-man-preview+json"
		}

		const client = new GitHubInstallationClient(
			new InstallationId(gheUrl, 4711, githubInstallationId),
			getLogger("test"),
			gitHubClientConfig,
			appTokenHolder
		);
		const pullrequests = await client.getPullRequests(owner, repo, {
			per_page: pageSize,
			page
		});

		expect(pullrequests).toBeTruthy();
		verifyMetricsSent("/repos/{owner}/{repo}/pulls", "200");
	});
});
